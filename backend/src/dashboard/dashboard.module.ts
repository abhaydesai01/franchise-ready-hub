import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { Proposal, ProposalSchema } from '../proposals/schemas/proposal.schema';
import { DiscoveryCall, CallSchema } from '../calls/schemas/call.schema';
import {
  PipelineStage,
  PipelineStageSchema,
} from '../pipeline/schemas/pipeline-stage.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lead.name, schema: LeadSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Proposal.name, schema: ProposalSchema },
      { name: DiscoveryCall.name, schema: CallSchema },
      { name: PipelineStage.name, schema: PipelineStageSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
