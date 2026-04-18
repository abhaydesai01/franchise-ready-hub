import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { SalesAlert, SalesAlertSchema } from './schemas/sales-alert.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Activity, ActivitySchema } from '../activities/schemas/activity.schema';
import { DiscoveryCall, CallSchema } from '../calls/schemas/call.schema';
import { Proposal, ProposalSchema } from '../proposals/schemas/proposal.schema';
import {
  AppSettings,
  AppSettingsSchema,
} from '../settings/schemas/settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SalesAlert.name, schema: SalesAlertSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: DiscoveryCall.name, schema: CallSchema },
      { name: Proposal.name, schema: ProposalSchema },
      { name: AppSettings.name, schema: AppSettingsSchema },
    ]),
  ],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
