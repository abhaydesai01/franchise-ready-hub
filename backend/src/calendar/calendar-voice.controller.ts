import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from './calendar.service';
import { SlotUnavailableException } from './calendar.exceptions';

@Controller('voice')
export class CalendarVoiceController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly config: ConfigService,
  ) {}

  private assertKey(key: string | undefined) {
    const expected = this.config.get<string>('voiceApiKey') ?? '';
    if (!expected || key !== expected) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('available-slots')
  async availableSlots(
    @Query('key') key: string,
    @Query('leadId') leadId?: string,
  ) {
    this.assertKey(key);
    try {
      const slots = await Promise.race([
        this.calendar.getAvailableSlots('voice', 3),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('timeout')), 1500),
        ),
      ]);
      if (leadId) await this.calendar.cacheVoiceSlots(leadId, slots);
      return slots;
    } catch {
      if (leadId) {
        const cached = await this.calendar.getCachedVoiceSlots(leadId);
        if (cached?.length) return cached;
      }
      const slots = await this.calendar.getAvailableSlots('voice', 3);
      if (leadId) await this.calendar.cacheVoiceSlots(leadId, slots);
      return slots;
    }
  }

  @Post('book-slot')
  async bookSlot(
    @Query('key') key: string,
    @Body()
    body: {
      leadId?: string;
      slotIndex?: number;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
    },
  ) {
    this.assertKey(key);
    const leadId = body.leadId?.trim();
    if (!leadId) {
      return { success: false, message: 'leadId required' };
    }
    const cached = await this.calendar.getCachedVoiceSlots(leadId);
    if (!cached?.length || body.slotIndex == null) {
      return { success: false, message: 'No slot context — request available slots first.' };
    }
    const slot = cached[body.slotIndex - 1];
    if (!slot) {
      return { success: false, message: 'Invalid slot index.' };
    }
    try {
      const result = await this.calendar.bookSlot({
        leadId,
        slotStartTime: new Date(slot.startTime),
        slotEndTime: new Date(slot.endTime),
        leadName: body.contactName ?? 'Lead',
        leadEmail: body.contactEmail ?? '',
        leadPhone: body.contactPhone,
        bookedVia: 'crm_voice',
      });
      const labelFull = result.labelFull;
      return {
        success: true,
        meetLink: result.meetLink,
        confirmationMessage: `Perfect — your call is confirmed for ${labelFull}. You'll receive a WhatsApp confirmation and a calendar invite on your email shortly. Is there anything you'd like to know before the call?`,
      };
    } catch (e) {
      if (e instanceof SlotUnavailableException) {
        return {
          success: false,
          message:
            'That slot was just taken by someone else — let me check what else is available for you.',
        };
      }
      throw e;
    }
  }
}
