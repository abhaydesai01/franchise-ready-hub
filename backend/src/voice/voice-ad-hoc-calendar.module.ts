import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { CalendarModule } from '../calendar/calendar.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VoiceScorecardEmailBuilderService } from './voice-scorecard-email-builder.service';
import { VoiceAdHocCalendarService } from './voice-ad-hoc-calendar.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
    CalendarModule,
    SettingsModule,
    NotificationsModule,
  ],
  providers: [VoiceScorecardEmailBuilderService, VoiceAdHocCalendarService],
  exports: [VoiceAdHocCalendarService, VoiceScorecardEmailBuilderService],
})
export class VoiceAdHocCalendarModule {}
