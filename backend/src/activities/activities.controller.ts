import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('activities')
  listAll() {
    return this.activitiesService.listAll();
  }

  @Get('leads/:leadId/activities')
  listForLead(@Param('leadId') leadId: string) {
    return this.activitiesService.listForLead(leadId);
  }

  @Post('leads/:leadId/activities')
  createForLead(
    @Param('leadId') leadId: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activitiesService.createForLead(leadId, dto);
  }
}
