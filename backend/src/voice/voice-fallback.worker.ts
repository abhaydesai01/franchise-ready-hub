/**
 * After `nest build`:
 *   REDIS_URL=... MONGODB_URI=... VOICE_API_KEY=... VOICE_ASSISTANT_ID=... VAPI_PHONE_NUMBER_ID=... \
 *   node dist/voice/voice-fallback.worker.js
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Worker } from 'bullmq';
import { Model } from 'mongoose';
import { Lead, type LeadDocument } from '../leads/schemas/lead.schema';
import { createBullConnection } from '../queues/redis-connection';
import type { VoiceTriggerPoint } from './voice-agent.service';
import { VoiceAgentService } from './voice-agent.service';
import { VoiceFallbackWorkerModule } from './voice-fallback.worker.module';

type FallbackJobData = {
  leadId: string;
  phone: string;
  name: string;
  expectedBotState: 'WARM_INTRO' | 'SLOT_OFFER';
  triggerPoint: 'warm_intro' | 'slot_offer';
  attempt?: number;
};

function toVapiTrigger(tp: 'warm_intro' | 'slot_offer'): VoiceTriggerPoint {
  return tp === 'warm_intro' ? 'intro_no_response' : 'slot_no_response';
}

async function run() {
  const app = await NestFactory.createApplicationContext(VoiceFallbackWorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  const voiceAgent = app.get(VoiceAgentService);
  const leadModel = app.get<Model<LeadDocument>>(getModelToken(Lead.name));

  const connection = createBullConnection('voice-fallback-worker');

  const worker = new Worker(
    'voice-fallback',
    async (job) => {
      const data = job.data as FallbackJobData;

      if (job.name === 'voice-fallback') {
        const lead = await leadModel.findById(data.leadId).exec();
        if (!lead?.phone) return;
        if (lead.botState !== data.expectedBotState) return;
        await voiceAgent.initiateCall(lead, toVapiTrigger(data.triggerPoint));
        return;
      }

      if (job.name === 'voice-fallback-retry' || job.name === 'voice-callback') {
        const lead = await leadModel.findById(data.leadId).exec();
        if (!lead?.phone) return;
        if (data.expectedBotState && lead.botState !== data.expectedBotState) {
          return;
        }
        const tp = data.triggerPoint
          ? toVapiTrigger(data.triggerPoint)
          : 'slot_no_response';
        await voiceAgent.initiateCall(lead, tp);
      }
    },
    { connection, concurrency: 3 },
  );

  worker.on('failed', (job, err) => {
    console.error('[voice-fallback] job failed', job?.id, err);
  });

  console.log('[voice-fallback] worker listening');
}

void run().catch((e) => {
  console.error(e);
  process.exit(1);
});
