import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WhatsappInboxService } from './whatsapp-inbox.service';

@Controller('whatsapp')
export class WhatsappInboxController {
  constructor(
    private readonly inbox: WhatsappInboxService,
    private readonly config: ConfigService,
  ) {}

  @Get('inbox')
  @UseGuards(JwtAuthGuard)
  getInbox() {
    return this.inbox.getInbox();
  }

  @Get('messages/:leadId')
  @UseGuards(JwtAuthGuard)
  getMessages(@Param('leadId') leadId: string) {
    return this.inbox.getMessagesByLeadId(leadId);
  }

  /**
   * Internal endpoint called by Freddy bot after each message.
   * Schedules (or resets) a 10-minute inactivity call timer.
   * Protected by INTERNAL_WEBHOOK_SECRET.
   */
  @Post('schedule-inactivity-call')
  @HttpCode(200)
  async scheduleInactivityCall(
    @Headers('x-internal-secret') secret: string | undefined,
    @Body()
    body: {
      phone: string;
      leadId: string;
      state: string;
      session: Record<string, unknown>;
    },
  ) {
    const expected = this.config.get<string>('internalWebhookSecret')?.trim();
    if (expected && String(secret ?? '') !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    await this.inbox.scheduleInactivityCall(body);
    return { ok: true };
  }
}
