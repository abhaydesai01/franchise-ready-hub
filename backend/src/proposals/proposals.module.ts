import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProposalsController } from './proposals.controller';
import { ProposalsPortalController } from './proposals-portal.controller';
import { InternalProposalsController } from './internal-proposals.controller';
import { ProposalsService } from './proposals.service';
import { ProposalSendService } from './proposal-send.service';
import { ProposalPublicService } from './proposal-public.service';
import { Proposal, ProposalSchema } from './schemas/proposal.schema';
import { ProposalViewEvent, ProposalViewEventSchema } from './schemas/proposal-view.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { DocumentsModule } from '../documents/documents.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClientsModule } from '../clients/clients.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { SettingsModule } from '../settings/settings.module';
import { QueueCancellationModule } from '../queues/queue-cancellation.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Proposal.name, schema: ProposalSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Client.name, schema: ClientSchema },
      { name: ProposalViewEvent.name, schema: ProposalViewEventSchema },
    ]),
    DocumentsModule,
    WhatsappModule,
    ActivitiesModule,
    NotificationsModule,
    ClientsModule,
    PipelineModule,
    SettingsModule,
    QueueCancellationModule,
    AlertsModule,
  ],
  controllers: [
    ProposalsPortalController,
    InternalProposalsController,
    ProposalsController,
  ],
  providers: [ProposalsService, ProposalSendService, ProposalPublicService],
  exports: [ProposalsService, ProposalSendService, ProposalPublicService],
})
export class ProposalsModule {}
