import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalStatusDto } from './dto/update-proposal-status.dto';

@Controller('proposals')
@UseGuards(JwtAuthGuard)
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get()
  list(@Query('status') status?: string, @Query('leadId') leadId?: string) {
    return this.proposalsService.list({ status, leadId });
  }

  @Post()
  create(@Body() dto: CreateProposalDto) {
    return this.proposalsService.create(dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateProposalStatusDto) {
    return this.proposalsService.updateStatus(id, dto.status);
  }

  @Post(':id/send-whatsapp')
  sendViaWhatsApp(@Param('id') id: string) {
    return this.proposalsService.sendViaWhatsApp(id);
  }

  @Post(':id/send-email')
  sendViaEmail(@Param('id') id: string) {
    return this.proposalsService.sendViaEmail(id);
  }

  @Get(':id/pdf')
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.proposalsService.getPdfBuffer(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
