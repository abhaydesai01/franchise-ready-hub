import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { CalendarService } from '../calendar/calendar.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VoiceScorecardEmailBuilderService } from './voice-scorecard-email-builder.service';
import {
  isFutureEnough,
  parseAdHocSlotFromText,
} from './voice-ad-hoc-booking.util';
import { SlotUnavailableException } from '../calendar/calendar.exceptions';

@Injectable()
export class VoiceAdHocCalendarService {
  private readonly log = new Logger(VoiceAdHocCalendarService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly calendar: CalendarService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly scorecardBuilder: VoiceScorecardEmailBuilderService,
  ) {}

  /**
   * If the voice summary/transcript includes clear booking language + a parseable date/time
   * (not limited to the 3 pre-offered slot indices), create a Google Meet, update the lead, and
   * email the consultant + lead (rich scorecard in HTML when `GEMINI_API_KEY` is set for answers).
   */
  async tryBookFromVoice(leadId: string, vaaniCallId: string): Promise<'skipped' | 'booked' | 'failed'> {
    const lead = await this.leadModel
      .findById(leadId)
      .lean<(Lead & { _id: Types.ObjectId }) | null>()
      .exec();
    if (!lead) {
      return 'skipped';
    }

    const email = (lead.email ?? '').trim();
    if (!email) {
      this.log.log(`Ad-hoc voice book skipped: lead ${leadId} has no email`);
      return 'skipped';
    }

    const existing = lead.discoveryCall;
    if (
      existing?.status === 'scheduled' &&
      existing.scheduledAt &&
      new Date(existing.scheduledAt).getTime() - Date.now() > 2 * 60_000
    ) {
      return 'skipped';
    }

    const vc = lead.voiceCalls?.find((c) => c.vaaniCallId === vaaniCallId);
    if (!vc || vc.calendarBookedAt) {
      return 'skipped';
    }

    const text = [vc.summary, vc.transcript]
      .filter((x) => String(x ?? '').trim().length > 0)
      .join('\n\n');
    if (text.length < 12) {
      return 'skipped';
    }

    const app = await this.settings.getSettings();
    const slotMin = app?.availabilitySettings?.slotDurationMinutes ?? 30;
    const window = parseAdHocSlotFromText(text, new Date(), slotMin);
    if (!window) {
      return 'skipped';
    }
    if (!isFutureEnough(window.start, 2)) {
      this.log.log('Ad-hoc parse produced a time in the past; skipping book');
      return 'skipped';
    }

    const bodies = await this.scorecardBuilder.buildBodies(
      String(vc.summary ?? ''),
      String(vc.transcript ?? ''),
    );

    try {
      await this.calendar.bookSlot({
        leadId,
        slotStartTime: window.start,
        slotEndTime: window.end,
        leadName: lead.name,
        leadEmail: email,
        leadPhone: lead.phone,
        bookedVia: 'crm_voice_ad_hoc',
        adHocFromVoice: {
          eventDescription: bodies.eventDescription,
          leadBodyHtml: bodies.leadHtml,
          consultantBodyHtml: bodies.consultantHtml,
        },
      });

      await this.leadModel
        .updateOne(
          { _id: leadId, 'voiceCalls.vaaniCallId': vaaniCallId },
          { $set: { 'voiceCalls.$[vc].calendarBookedAt': new Date() } },
          { arrayFilters: [{ 'vc.vaaniCallId': vaaniCallId }] },
        )
        .exec();
      this.log.log(`Ad-hoc voice calendar booked for lead ${leadId}`);
      return 'booked';
    } catch (e) {
      if (e instanceof SlotUnavailableException) {
        this.log.log(`Ad-hoc slot not free for lead ${leadId} — not booking`);
        void this.notifications
          .notifyAdminsAndManagers({
            type: 'voice_booking_failed',
            description: `Ad-hoc time from voice conflicts with the calendar. Lead: ${lead.name}. Book manually or free the slot.`,
            leadId: String(leadId),
          })
          .catch(() => {});
        return 'failed';
      }
      this.log.warn(`Ad-hoc voice booking error lead=${leadId}`, e);
      return 'failed';
    }
  }
}
