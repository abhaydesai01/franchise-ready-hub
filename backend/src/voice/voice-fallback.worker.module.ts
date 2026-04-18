import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from '../config/configuration';
import { validate } from '../config/validation';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { SettingsModule } from '../settings/settings.module';
import { VoiceAgentService } from './voice-agent.service';
import { VaaniModule } from './vaani.module';
import { CalendarModule } from '../calendar/calendar.module';
import { ActivitiesModule } from '../activities/activities.module';
import { NurtureQueueService } from './nurture-queue.service';
import { GeminiScoringModule } from './gemini-scoring.module';
import { VoicePipelineSyncModule } from './voice-pipeline-sync.module';
import { VoiceAdHocCalendarModule } from './voice-ad-hoc-calendar.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI,
      }),
    }),
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
    SettingsModule,
    CalendarModule,
    ActivitiesModule,
    VaaniModule,
    GeminiScoringModule,
    VoicePipelineSyncModule,
    VoiceAdHocCalendarModule,
  ],
  providers: [VoiceAgentService, NurtureQueueService],
})
export class VoiceFallbackWorkerModule {}
