import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { Lead, LeadSchema } from './schemas/lead.schema';
import { PipelineModule } from '../pipeline/pipeline.module';
import { UsersModule } from '../users/users.module';
import { Activity, ActivitySchema } from '../activities/schemas/activity.schema';
import {
  AutomationLog,
  AutomationLogSchema,
} from '../automation/schemas/automation-log.schema';
import { AppSettings, AppSettingsSchema } from '../settings/schemas/settings.schema';
import { BriefingModule } from '../briefing/briefing.module';
import { ActivitiesModule } from '../activities/activities.module';
import { PostCallPipelineService } from './post-call-pipeline.service';
import { ProposalsModule } from '../proposals/proposals.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lead.name, schema: LeadSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: AutomationLog.name, schema: AutomationLogSchema },
      { name: AppSettings.name, schema: AppSettingsSchema },
    ]),
    PipelineModule,
    UsersModule,
    BriefingModule,
    ActivitiesModule,
    ProposalsModule,
  ],
  controllers: [LeadsController],
  providers: [LeadsService, PostCallPipelineService],
  exports: [LeadsService, MongooseModule],
})
export class LeadsModule {}
