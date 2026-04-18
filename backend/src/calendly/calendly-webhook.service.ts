import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { SettingsService } from '../settings/settings.service';
import { QueueCancellationService } from './queue-cancellation.service';
import { CalendlyReminderService } from './calendly-reminder.service';
import { WhatsappCloudService } from '../whatsapp/whatsapp-cloud.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivitiesService } from '../activities/activities.service';
import { UsersService } from '../users/users.service';
import { verifyCalendlySignature } from './calendly-signature';
import {
  extractInvitee,
  extractJoinUrl,
  extractScheduledEvent,
  getEventName,
  type CalendlyWebhookBody,
} from './calendly-payload';

const BOOKING_CONFIRMED_TEXT =
  "Your discovery call is confirmed! You'll receive a calendar invite and your Franchise Readiness Report shortly. See you on the call! 🎯";

@Injectable()
export class CalendlyWebhookService {
  private readonly log = new Logger(CalendlyWebhookService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly settingsService: SettingsService,
    private readonly queueCancel: QueueCancellationService,
    private readonly reminders: CalendlyReminderService,
    private readonly whatsapp: WhatsappCloudService,
    private readonly notifications: NotificationsService,
    private readonly activities: ActivitiesService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async handleWebhook(raw: Buffer, signatureHeader: string | undefined): Promise<{ ok: true }> {
    const settings = await this.settingsService.getSettings();
    const secret = settings?.calendlyWebhookSigningKey?.trim() ?? '';
    if (!secret) {
      this.log.error('calendlyWebhookSigningKey not configured');
      throw new UnauthorizedException();
    }
    if (!verifyCalendlySignature(signatureHeader, raw, secret)) {
      throw new UnauthorizedException();
    }

    let body: CalendlyWebhookBody;
    try {
      body = JSON.parse(raw.toString('utf8')) as CalendlyWebhookBody;
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }

    const event = getEventName(body);
    const invitee = extractInvitee(body);
    const scheduled = extractScheduledEvent(body);
    const email = invitee?.email?.trim().toLowerCase();
    if (!email) {
      this.log.warn('Calendly webhook missing invitee email');
      return { ok: true };
    }

    if (!invitee) {
      this.log.warn('Calendly webhook missing invitee payload');
      return { ok: true };
    }

    if (
      event === 'invitee.created' &&
      invitee?.rescheduled === true
    ) {
      await this.handleRescheduled(email, body, scheduled, invitee);
      return { ok: true };
    }

    if (event === 'invitee.rescheduled') {
      await this.handleRescheduled(email, body, scheduled, invitee);
      return { ok: true };
    }

    if (event === 'invitee.created') {
      await this.handleCreated(email, body, scheduled, invitee);
      return { ok: true };
    }

    if (event === 'invitee.canceled') {
      await this.handleCanceled(email, body);
      return { ok: true };
    }

    this.log.debug(`Ignoring Calendly event: ${event}`);
    return { ok: true };
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async findLeadByEmail(email: string): Promise<LeadDocument | null> {
    return this.leadModel
      .findOne({ email: new RegExp(`^${this.escapeRegex(email)}$`, 'i') })
      .exec();
  }

  private scorecardSummary(lead: Lead & { _id?: Types.ObjectId }): string {
    const data = lead.scorecardData as
      | {
          totalScore?: number;
          readinessBand?: string;
          readinessSummary?: string;
        }
      | undefined;
    if (!data) return `Score: ${lead.totalScore ?? lead.score ?? '—'}/100`;
    return [
      `Score: ${data.totalScore ?? lead.totalScore ?? '—'}/100`,
      data.readinessBand ? `Band: ${data.readinessBand}` : '',
      data.readinessSummary ? data.readinessSummary.slice(0, 280) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  private async sendResend(to: string, subject: string, html: string) {
    const key = this.config.get<string>('resendApiKey') ?? '';
    if (!key) {
      this.log.warn('RESEND_API_KEY not set — skip email');
      return;
    }
    const from = this.config.get<string>('resendFromEmail') ?? 'onboarding@resend.dev';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
  }

  private crmLeadUrl(leadId: string): string {
    const base = this.config.get<string>('crmPublicUrl')?.trim();
    if (!base) return `/leads/${leadId}`;
    return `${base}/leads/${leadId}`;
  }

  private fmtTime(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  }

  private async handleCreated(
    email: string,
    body: CalendlyWebhookBody,
    scheduled: ReturnType<typeof extractScheduledEvent>,
    invitee: NonNullable<ReturnType<typeof extractInvitee>>,
  ) {
    const start = scheduled?.start_time;
    const end = scheduled?.end_time;
    const joinUrl = extractJoinUrl(scheduled);
    const eventUri = scheduled?.uri ?? '';
    if (!start) {
      this.log.warn('invitee.created missing start_time');
      return;
    }

    let lead = await this.findLeadByEmail(email);
    if (!lead) {
      const name = (invitee.name ?? email.split('@')[0] ?? 'Calendly lead').trim();
      lead = await this.leadModel.create({
        name,
        email,
        source: 'calendly_direct',
        track: 'Not Ready',
        stage: 'new',
        status: 'New',
        score: 0,
        scoreDimensions: [],
        tags: [],
      });
    }

    const startDate = new Date(start);
    const endDate = end ? new Date(end) : undefined;

    await this.queueCancel.cancelAllJobsForLead(String(lead._id));

    const updated = await this.leadModel
      .findByIdAndUpdate(
        lead._id,
        {
          $set: {
            discoveryCall: {
              scheduledAt: startDate,
              endTime: endDate,
              meetingLink: joinUrl,
              calendlyEventUri: eventUri,
              status: 'scheduled',
            },
            stage: 'call_booked',
            botState: 'BOOKING_CONFIRMED',
          },
        },
        { new: true },
      )
      .exec();
    if (!updated) return;

    if (updated.phone) {
      await this.whatsapp.sendText(updated.phone, BOOKING_CONFIRMED_TEXT);
    }

    const consultantEmail = updated.ownerId
      ? await this.users.getEmailById(String(updated.ownerId))
      : null;
    const calendlyLink =
      (await this.settingsService.getSettings())?.calendlyLink?.trim() ||
      this.config.get<string>('calendlyLink')?.trim() ||
      '';

    const summary = this.scorecardSummary(updated);
    const when = this.fmtTime(start);
    if (consultantEmail) {
      await this.sendResend(
        consultantEmail,
        `Discovery booked — ${updated.name}`,
        `<p><strong>${updated.name}</strong> booked a discovery call.</p>
<p><strong>When:</strong> ${when}<br/>
<strong>Meet:</strong> <a href="${joinUrl}">${joinUrl || '—'}</a></p>
<p><strong>Scorecard:</strong> ${escapeHtml(summary)}</p>
<p><a href="${this.crmLeadUrl(String(updated._id))}">Open lead in CRM</a></p>`,
      );
    }

    await this.notifications.notifyAdminsAndManagers({
      type: 'calendly_booking',
      leadId: String(updated._id),
      description: `${updated.name} booked a discovery call (${when}).`,
    });

    await this.activities.logCalendlyEvent(
      String(updated._id),
      'calendly_booking_created',
      `Discovery call scheduled for ${when}.`,
    );

    await this.reminders.schedulePreCallReminders({
      leadId: String(updated._id),
      leadName: updated.name,
      leadPhone: updated.phone,
      leadEmail: updated.email,
      meetingLink: joinUrl,
      scheduledAt: startDate,
      consultantEmail: consultantEmail ?? undefined,
    });
  }

  private async handleCanceled(email: string, _body: CalendlyWebhookBody) {
    const lead = await this.findLeadByEmail(email);
    if (!lead) return;

    await this.queueCancel.cancelAllJobsForLead(String(lead._id));

    const calendlyLink =
      (await this.settingsService.getSettings())?.calendlyLink?.trim() ||
      this.config.get<string>('calendlyLink')?.trim() ||
      '';

    await this.leadModel
      .findByIdAndUpdate(lead._id, {
        $set: {
          'discoveryCall.status': 'cancelled',
          stage: 'slot_offer',
          botState: 'SLOT_OFFER',
        },
      })
      .exec();

    if (lead.phone && calendlyLink) {
      await this.whatsapp.sendText(
        lead.phone,
        `We noticed you cancelled the discovery call — no worries! Here's the link to rebook at a time that works better for you: ${calendlyLink}`,
      );
    }

    await this.activities.logCalendlyEvent(
      String(lead._id),
      'calendly_booking_cancelled',
      'Discovery call cancelled by invitee.',
    );
  }

  private async handleRescheduled(
    email: string,
    _body: CalendlyWebhookBody,
    scheduled: ReturnType<typeof extractScheduledEvent>,
    invitee: NonNullable<ReturnType<typeof extractInvitee>>,
  ) {
    const start = scheduled?.start_time;
    const end = scheduled?.end_time;
    const joinUrl = extractJoinUrl(scheduled);
    const eventUri = scheduled?.uri ?? '';
    if (!start) return;

    let lead = await this.findLeadByEmail(email);
    if (!lead) {
      await this.handleCreated(email, _body, scheduled, invitee);
      return;
    }

    const startDate = new Date(start);
    const endDate = end ? new Date(end) : undefined;

    await this.reminders.cancelReminderJobs(String(lead._id));
    await this.reminders.schedulePreCallReminders({
      leadId: String(lead._id),
      leadName: lead.name,
      leadPhone: lead.phone,
      leadEmail: lead.email,
      meetingLink: joinUrl,
      scheduledAt: startDate,
      consultantEmail: lead.ownerId
        ? (await this.users.getEmailById(String(lead.ownerId))) ?? undefined
        : undefined,
    });

    await this.leadModel
      .findByIdAndUpdate(lead._id, {
        $set: {
          discoveryCall: {
            scheduledAt: startDate,
            endTime: endDate,
            meetingLink: joinUrl,
            calendlyEventUri: eventUri,
            status: 'scheduled',
          },
        },
      })
      .exec();

    const when = this.fmtTime(start);
    if (lead.phone) {
      await this.whatsapp.sendText(
        lead.phone,
        `Your discovery call was moved to ${when}. Join here: ${joinUrl || 'link in email'}`,
      );
    }

    const consultantEmail = lead.ownerId
      ? await this.users.getEmailById(String(lead.ownerId))
      : null;
    if (consultantEmail) {
      await this.sendResend(
        consultantEmail,
        `Discovery call rescheduled — ${lead.name}`,
        `<p>${lead.name}'s call is now <strong>${when}</strong>.</p>
<p><a href="${joinUrl}">Meeting link</a></p>`,
      );
    }

    if (lead.email) {
      await this.sendResend(
        lead.email,
        `Discovery call updated — ${when}`,
        `<p>Your franchise discovery call is now scheduled for <strong>${when}</strong>.</p>
<p><a href="${joinUrl}">Join link</a></p>`,
      );
    }

    await this.activities.logCalendlyEvent(
      String(lead._id),
      'calendly_rescheduled',
      `Call rescheduled to ${when}.`,
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
