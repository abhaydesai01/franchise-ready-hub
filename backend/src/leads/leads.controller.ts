import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { BriefingService } from '../briefing/briefing.service';
import { BriefingPdfService } from '../briefing/briefing-pdf.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStageDto } from './dto/update-lead-stage.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { UpdateLeadOwnerDto } from './dto/update-lead-owner.dto';
import { DiscoveryCallPatchDto } from './dto/discovery-call-patch.dto';
import { PostCallNotesDto } from './dto/post-call-notes.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly briefingService: BriefingService,
    private readonly briefingPdfService: BriefingPdfService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('track') track?: string,
    @Query('stage') stage?: string,
    @Query('search') search?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('ownerId') ownerId?: string,
    @Query('status') status?: string,
    @Query('pipelineStageId') pipelineStageId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leadsService.list(user, {
      track,
      stage,
      search,
      assignedTo,
      ownerId,
      status,
      pipelineStageId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('health')
  async health(@CurrentUser() user: CurrentUserPayload) {
    return this.leadsService.healthMap(user);
  }

  @Get(':id/briefing/pdf')
  async briefingPdf(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<StreamableFile> {
    const briefing = await this.briefingService.getBriefing(id, user);
    const buf = await this.briefingPdfService.buildPdf(briefing);
    const safe = briefing.leadProfile.name.replace(/[^\w\-]+/g, '_').slice(0, 60);
    return new StreamableFile(buf, {
      type: 'application/pdf',
      disposition: `attachment; filename="briefing-${safe}-${id}.pdf"`,
    });
  }

  @Get(':id/briefing')
  async briefing(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.briefingService.getBriefing(id, user);
  }

  @Get(':id/journey')
  async journey(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.leadsService.journey(id, user);
  }

  @Get(':id/whatsapp')
  async whatsapp(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.whatsappConversation(id, user);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.findById(id, user);
  }

  @Post()
  async create(
    @Body() dto: CreateLeadDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.create(dto, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.update(id, dto, user);
  }

  @Patch(':id/stage')
  async updateStage(
    @Param('id') id: string,
    @Body() body: UpdateLeadStageDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.updateStage(id, body, user);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateLeadStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.updateStatus(
      id,
      body.status,
      body.lostReason,
      user,
    );
  }

  @Patch(':id/owner')
  async updateOwner(
    @Param('id') id: string,
    @Body() body: UpdateLeadOwnerDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.updateOwner(id, body.ownerId, user);
  }

  @Patch(':id/discovery-call')
  async patchDiscoveryCall(
    @Param('id') id: string,
    @Body() _body: DiscoveryCallPatchDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.markDiscoveryCallComplete(id, user);
  }

  @Post(':id/post-call-notes')
  async submitPostCallNotes(
    @Param('id') id: string,
    @Body() body: PostCallNotesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.submitPostCallNotes(id, body, user);
  }

  @Post(':id/documents/:docEntryId/approve-send')
  async approveSendDocument(
    @Param('id') id: string,
    @Param('docEntryId') docEntryId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.leadsService.approveAndSendDocument(id, docEntryId, user);
  }
}
