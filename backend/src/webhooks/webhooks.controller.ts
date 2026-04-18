import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CalendlyWebhookService } from '../calendly/calendly-webhook.service';
import { CalendarService } from '../calendar/calendar.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly calendlyWebhook: CalendlyWebhookService,
    private readonly calendar: CalendarService,
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
}
