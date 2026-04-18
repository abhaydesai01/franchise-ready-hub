import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutomationService } from './automation.service';
import { UpdateAutomationSequenceDto } from './dto/update-automation-sequence.dto';
import { UpdateReEngagementRuleDto } from './dto/update-re-engagement-rule.dto';

@Controller('automation')
@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get('sequences')
  listSequences() {
    return this.automationService.listSequences();
  }

  @Patch('sequences/:id')
  updateSequence(
    @Param('id') id: string,
    @Body() dto: UpdateAutomationSequenceDto,
  ) {
    return this.automationService.updateSequence(id, dto);
  }

  @Get('logs')
  listLogs(
    @Query('leadId') leadId?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
  ) {
    return this.automationService.listAutomationLogs({
      leadId,
      channel,
      status,
    });
  }

  @Get('re-engagement/rules')
  listReEngagementRules() {
    return this.automationService.listReEngagementRules();
  }

  @Patch('re-engagement/rules/:id')
  updateReEngagementRule(
    @Param('id') id: string,
    @Body() dto: UpdateReEngagementRuleDto,
  ) {
    return this.automationService.updateReEngagementRule(id, dto.enabled);
  }

  @Get('re-engagement/logs')
  listReEngagementLogs() {
    return this.automationService.listReEngagementLogs();
  }
}
