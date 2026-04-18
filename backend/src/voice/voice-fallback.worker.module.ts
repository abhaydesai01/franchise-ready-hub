import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from '../config/configuration';
import { validate } from '../config/validation';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { SettingsModule } from '../settings/settings.module';
import { VoiceAgentService } from './voice-agent.service';

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
  ],
  providers: [VoiceAgentService],
})
export class VoiceFallbackWorkerModule {}
