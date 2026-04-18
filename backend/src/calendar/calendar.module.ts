import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CalendarIntegration, CalendarIntegrationSchema } from './calendar-integration.schema';
import { CalendarTokenCryptoService } from './calendar-token-crypto.service';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { CalendarVoiceController } from './calendar-voice.controller';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivitiesModule } from '../activities/activities.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CalendarIntegration.name, schema: CalendarIntegrationSchema },
      { name: Lead.name, schema: LeadSchema },
    ]),
    SettingsModule,
    NotificationsModule,
    ActivitiesModule,
    WhatsappModule,
  ],
  controllers: [CalendarController, CalendarVoiceController],
  providers: [CalendarTokenCryptoService, CalendarService],
  exports: [CalendarService, CalendarTokenCryptoService],
})
export class CalendarModule {}
