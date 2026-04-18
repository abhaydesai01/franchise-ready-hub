import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivitiesModule } from '../activities/activities.module';
import { DocumentGenerationService } from './document-generation.service';
import { DocumentPdfService } from './document-pdf.service';
import { DocumentStorageService } from './document-storage.service';
import { ProposalPdfSigningService } from './proposal-pdf-signing.service';
import { ProposalFollowupQueueService } from './proposal-followup-queue.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
    SettingsModule,
    UsersModule,
    NotificationsModule,
    ActivitiesModule,
  ],
  providers: [
    DocumentGenerationService,
    DocumentPdfService,
    DocumentStorageService,
    ProposalPdfSigningService,
    ProposalFollowupQueueService,
  ],
  exports: [
    DocumentGenerationService,
    DocumentPdfService,
    DocumentStorageService,
    ProposalPdfSigningService,
    ProposalFollowupQueueService,
  ],
})
export class DocumentsModule {}
