import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { SettingsModule } from '../settings/settings.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ActivitiesModule } from '../activities/activities.module';
import { VoiceAgentService } from './voice-agent.service';
import { VoiceWebhookService } from './voice-webhook.service';
import { VoiceWebhookController } from './voice-webhook.controller';
import { NurtureQueueService } from './nurture-queue.service';
import { VaaniModule } from './vaani.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
    SettingsModule,
    WhatsappModule,
    ActivitiesModule,
    VaaniModule,
  ],
  controllers: [VoiceWebhookController],
  providers: [VoiceAgentService, VoiceWebhookService, NurtureQueueService],
  exports: [VoiceAgentService, NurtureQueueService, VaaniModule],
})
export class VoiceModule {}
