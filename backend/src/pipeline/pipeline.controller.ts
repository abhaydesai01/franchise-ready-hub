import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PipelineService } from './pipeline.service';
import { ReorderPipelineStagesDto } from './dto/reorder-pipeline-stages.dto';

@Controller('pipeline')
@UseGuards(JwtAuthGuard)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('stages')
  listStages(@Query('track') track?: string) {
    return this.pipelineService.listByTrack(track);
  }

  @Patch('stages/reorder')
  reorder(@Body() dto: ReorderPipelineStagesDto) {
    return this.pipelineService
      .reorder(dto.track, dto.stageIds)
      .then(() => ({ ok: true }));
  }
}
