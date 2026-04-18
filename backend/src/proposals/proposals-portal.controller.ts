import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ProposalPublicService } from './proposal-public.service';
import { TrackProposalDto } from './dto/track-proposal.dto';
import { SignProposalDto } from './dto/sign-proposal.dto';

@Controller('proposals')
export class ProposalsPortalController {
  constructor(private readonly proposalPublic: ProposalPublicService) {}

  @Get('view-meta/:token')
  viewMeta(@Param('token') token: string) {
    return this.proposalPublic.getViewMeta(token);
  }

  @Post('track')
  async track(@Body() body: TrackProposalDto, @Req() req: Request) {
    const token = body.token.trim();
    if (!token) {
      return { ok: false, error: 'token_required' };
    }
    const fwd = req.headers['x-forwarded-for'];
    const fwdStr = typeof fwd === 'string' ? fwd.split(',')[0]?.trim() : undefined;
    const ip = fwdStr || req.socket?.remoteAddress;
    await this.proposalPublic.trackView(
      token,
      req.headers['user-agent'],
      ip,
    );
    return { ok: true };
  }

  @Post('sign/:token')
  sign(@Param('token') token: string, @Body() body: SignProposalDto) {
    return this.proposalPublic.signProposal(token, body.signaturePngBase64);
  }
}
