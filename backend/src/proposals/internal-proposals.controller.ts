import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalSecretGuard } from '../auth/internal-secret.guard';
import { ProposalPublicService } from './proposal-public.service';

@Controller('internal')
export class InternalProposalsController {
  constructor(private readonly proposalPublic: ProposalPublicService) {}

  @Post('proposals/checkin-reply')
  @UseGuards(InternalSecretGuard)
  checkinReply(
    @Body() body: { leadId?: string; replySnippet?: string },
  ) {
    const leadId = body.leadId?.trim();
    const replySnippet = body.replySnippet?.trim() ?? '';
    if (!leadId) {
      return { ok: false, error: 'leadId required' };
    }
    return this.proposalPublic.recordCheckinWhatsAppReply(leadId, replySnippet);
  }
}
