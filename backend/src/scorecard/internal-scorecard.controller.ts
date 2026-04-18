import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ScorecardService } from './scorecard.service';
import { InternalScorecardKeyGuard } from './internal-scorecard.guard';

@Controller('internal/scorecard')
@UseGuards(InternalScorecardKeyGuard)
export class InternalScorecardController {
  constructor(private readonly scorecardService: ScorecardService) {}

  /** Called by CRM after SCORING completes (shared secret header). */
  @Post(':leadId/generate')
  async generate(@Param('leadId') leadId: string) {
    return this.scorecardService.generateAndDeliver(leadId);
  }
}
