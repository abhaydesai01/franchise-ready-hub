import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Request } from 'express';
import { CalendlyWebhookService } from '../calendly/calendly-webhook.service';
import { CalendarService } from '../calendar/calendar.service';
import { VaaniWebhookService } from '../voice/vaani-webhook.service';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';

/** Build a natural-language spoken sentence Vaani can read directly on the call. */
function buildSpokenText(
  slots: Array<{ index: number; label: string }>,
): string {
  if (!slots.length) {
    return "I'm sorry, there are no available slots right now. Our team will reach out to schedule your discovery call.";
  }
  const options = slots
    .map((s) => `Option ${s.index}: ${s.label}`)
    .join('. ');
  return (
    `We have ${slots.length} available slot${slots.length > 1 ? 's' : ''} for your discovery call. ` +
    `${options}. ` +
    `Which option works best for you?`
  );
}

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly calendlyWebhook: CalendlyWebhookService,
    private readonly calendar: CalendarService,
    private readonly vaaniWebhook: VaaniWebhookService,
    private readonly config: ConfigService,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
  ) {}

  @Post('calendly')
  @HttpCode(200)
  async calendly(@Req() req: Request & { rawBody?: Buffer }) {
    const raw = req.rawBody;
    if (!raw?.length) {
      throw new BadRequestException('Empty body');
    }
    const h = req.headers['calendly-webhook-signature'];
    const signature = Array.isArray(h) ? h[0] : h;
    return this.calendlyWebhook.handleWebhook(raw, signature);
  }

  /** Vaani Voice — call lifecycle + post-processing (configure secret in portal + VAANI_WEBHOOK_SECRET). */
  @Post('vaani')
  @HttpCode(200)
  async vaani(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.vaaniWebhook.handle(body, headers, req.rawBody);
  }

  /** GHL / external booking — creates CRM-native Meet + reminders (idempotent best-effort). */
  @Post('ghl-booking')
  @HttpCode(200)
  async ghlBooking(
    @Body()
    body: {
      leadId?: string;
      slotStartTime?: string;
      slotEndTime?: string;
      leadName?: string;
      leadEmail?: string;
      leadPhone?: string;
    },
  ) {
    if (
      !body.leadId ||
      !body.slotStartTime ||
      !body.slotEndTime ||
      !body.leadEmail
    ) {
      throw new BadRequestException(
        'leadId, slotStartTime, slotEndTime, leadEmail required',
      );
    }
    return this.calendar.bookSlot({
      leadId: body.leadId,
      slotStartTime: new Date(body.slotStartTime),
      slotEndTime: new Date(body.slotEndTime),
      leadName: body.leadName ?? 'Lead',
      leadEmail: body.leadEmail,
      leadPhone: body.leadPhone,
      bookedVia: 'ghl_link',
    });
  }

  // ── Vaani real-time slot & booking APIs ─────────────────────────────────

  /**
   * Vaani calls this DURING a live call to get available slots.
   * Returns a machine-readable list + a ready-to-speak sentence.
   *
   * URL:  GET /api/v1/webhooks/vaani-slots/:leadId
   * Auth: X-Vaani-Secret header (matches VAANI_WEBHOOK_SECRET)
   *
   * Share with Vaani team as a "tool call" endpoint.
   */
  @Get('vaani-slots/:leadId')
  async vaaniSlots(
    @Param('leadId') leadId: string,
    @Headers('x-vaani-secret') secret: string | undefined,
  ) {
    this.assertVaaniSecret(secret);

    // Prefer cached slots (set when we triggered the call)
    let slots = await this.calendar.getCachedVoiceSlots(leadId);

    // Fall back to live lookup if cache miss (e.g. manual call from Vaani portal)
    if (!slots || slots.length === 0) {
      try {
        slots = await this.calendar.getAvailableSlots('voice', 3);
        await this.calendar.cacheVoiceSlots(leadId, slots);
      } catch {
        return {
          leadId,
          slots: [],
          spokenText: buildSpokenText([]),
        };
      }
    }

    return {
      leadId,
      slots: slots.map((s) => ({
        index: s.index,
        label: s.label,
        labelShort: s.labelShort,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      spokenText: buildSpokenText(slots),
    };
  }

  /**
   * Vaani calls this the moment the lead verbally confirms a slot.
   * Books Google Calendar, creates a Meet link, and updates the CRM lead.
   *
   * URL:  POST /api/v1/webhooks/vaani-confirm-slot
   * Auth: X-Vaani-Secret header (matches VAANI_WEBHOOK_SECRET)
   * Body: { leadId, slotIndex }
   *
   * Share with Vaani team — call this at end-of-call when lead picks a slot.
   */
  @Post('vaani-confirm-slot')
  @HttpCode(200)
  async vaaniConfirmSlot(
    @Headers('x-vaani-secret') secret: string | undefined,
    @Body() body: { leadId?: string; slotIndex?: number | string },
  ) {
    this.assertVaaniSecret(secret);

    if (!body.leadId) throw new BadRequestException('leadId is required');
    const idx = parseInt(String(body.slotIndex ?? ''), 10);
    if (!idx || idx < 1) throw new BadRequestException('slotIndex must be a positive integer');

    const lead = await this.leadModel.findById(body.leadId).exec();
    if (!lead) throw new NotFoundException('Lead not found');

    // Get cached slots (pre-fetched before the call)
    const slots = await this.calendar.getCachedVoiceSlots(body.leadId);
    if (!slots?.length) {
      throw new BadRequestException(
        'No cached slots found for this lead. Call GET /webhooks/vaani-slots/:leadId first.',
      );
    }

    const chosen = slots.find((s) => s.index === idx) ?? slots[idx - 1];
    if (!chosen) {
      throw new BadRequestException(
        `Slot index ${idx} not found. Available: ${slots.map((s) => s.index).join(', ')}`,
      );
    }

    const email = (lead.email ?? '').trim();
    let result: { meetLink: string; labelFull: string; googleEventId?: string };

    if (email) {
      // Book with attendee invite (lead has email)
      result = await this.calendar.bookSlot({
        leadId: body.leadId,
        slotStartTime: new Date(chosen.startTime),
        slotEndTime: new Date(chosen.endTime),
        leadName: lead.name,
        leadEmail: email,
        leadPhone: lead.phone,
        bookedVia: 'crm_voice',
      });
    } else {
      // Book without attendee (no email on file yet)
      result = await this.calendar.bookSlotFromBot({
        leadId: body.leadId,
        slotStartTime: new Date(chosen.startTime),
        slotEndTime: new Date(chosen.endTime),
        leadName: lead.name,
        leadPhone: lead.phone,
      });
    }

    return {
      ok: true,
      leadId: body.leadId,
      slotIndex: idx,
      slotLabel: result.labelFull || chosen.label,
      meetLink: result.meetLink,
      googleEventId: result.googleEventId,
    };
  }

  private assertVaaniSecret(got: string | undefined): void {
    const expected = this.config.get<string>('vaaniWebhookSecret')?.trim();
    // If no secret configured, allow all (dev/staging without secret set)
    if (!expected) return;
    if (String(got ?? '') !== expected) {
      throw new UnauthorizedException('Invalid Vaani secret');
    }
  }
}
