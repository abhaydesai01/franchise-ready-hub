import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhooksController } from './webhooks.controller';
import { CalendlyWebhookService } from '../calendly/calendly-webhook.service';
import { CalendlyReminderService } from '../calendly/calendly-reminder.service';
import { WhatsappCloudService } from '../whatsapp/whatsapp-cloud.service';
import { LeadsModule } from '../leads/leads.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivitiesModule } from '../activities/activities.module';
import { UsersModule } from '../users/users.module';
import { QueueCancellationModule } from '../queues/queue-cancellation.module';
import { CalendarModule } from '../calendar/calendar.module';
import { VoiceModule } from '../voice/voice.module';
import { VaaniWebhookService } from '../voice/vaani-webhook.service';
import { GeminiScoringModule } from '../voice/gemini-scoring.module';
import { VoicePipelineSyncModule } from '../voice/voice-pipeline-sync.module';
import { VoiceAdHocCalendarModule } from '../voice/voice-ad-hoc-calendar.module';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';

@Module({
  imports: [
    QueueCancellationModule,
    CalendarModule,
    LeadsModule,
    SettingsModule,
    NotificationsModule,
    ActivitiesModule,
    UsersModule,
    VoiceModule,
    GeminiScoringModule,
    VoicePipelineSyncModule,
    VoiceAdHocCalendarModule,
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
  ],
  controllers: [WebhooksController],
  providers: [
    CalendlyWebhookService,
    CalendlyReminderService,
    WhatsappCloudService,
    VaaniWebhookService,
  ],
})
export class WebhooksModule {}
