import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import {
  AutomationSequence,
  AutomationSequenceSchema,
} from './schemas/automation-sequence.schema';
import {
  AutomationLog,
  AutomationLogSchema,
} from './schemas/automation-log.schema';
import {
  ReEngagementRule,
  ReEngagementRuleSchema,
} from './schemas/re-engagement-rule.schema';
import {
  ReEngagementLog,
  ReEngagementLogSchema,
} from './schemas/re-engagement-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AutomationSequence.name, schema: AutomationSequenceSchema },
      { name: AutomationLog.name, schema: AutomationLogSchema },
      { name: ReEngagementRule.name, schema: ReEngagementRuleSchema },
      { name: ReEngagementLog.name, schema: ReEngagementLogSchema },
    ]),
  ],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
