import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    QueueCancellationModule,
    CalendarModule,
    LeadsModule,
    SettingsModule,
    NotificationsModule,
    ActivitiesModule,
    UsersModule,
  ],
  controllers: [WebhooksController],
  providers: [
    CalendlyWebhookService,
    CalendlyReminderService,
    WhatsappCloudService,
  ],
})
export class WebhooksModule {}
