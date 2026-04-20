import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WhatsappInboxService } from './whatsapp-inbox.service';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappInboxController {
  constructor(private readonly inbox: WhatsappInboxService) {}

  @Get('inbox')
  getInbox() {
    return this.inbox.getInbox();
  }

  @Get('messages/:leadId')
  getMessages(@Param('leadId') leadId: string) {
    return this.inbox.getMessagesByLeadId(leadId);
  }
}
