/**
 * After `nest build`:
 *   REDIS_URL=... MONGODB_URI=... VOICE_API_KEY=... VOICE_ASSISTANT_ID=... VAPI_PHONE_NUMBER_ID=... \
 *   node dist/voice/voice-fallback.worker.js
 *
 * With Vaani: set VAANI_API_KEY, VAANI_AGENT_ID (VAANI_OUTBOUND_NUMBER optional).
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Worker } from 'bullmq';
import { Model } from 'mongoose';
import { Lead, type LeadDocument } from '../leads/schemas/lead.schema';
import { createBullConnection, getSingletonBullConnection } from '../queues/redis-connection';
import { Queue } from 'bullmq';
import { SettingsService } from '../settings/settings.service';
import { CalendarService } from '../calendar/calendar.service';
import { ActivitiesService } from '../activities/activities.service';
import { NurtureQueueService } from './nurture-queue.service';
import type { VoiceTriggerPoint } from './voice-agent.service';
import { VoiceAgentService } from './voice-agent.service';
import { VaaniService } from './vaani.service';
import { VoiceFallbackWorkerModule } from './voice-fallback.worker.module';
import { applyVoiceEnrichmentFromVaaniApis } from './apply-voice-enrichment';
import { GeminiVoiceScoringService } from './gemini-voice-scoring.service';
import { VoicePipelineSyncService } from './voice-pipeline-sync.service';
import { VoiceAdHocCalendarService } from './voice-ad-hoc-calendar.service';

type FallbackJobData = {
  leadId: string;
  phone: string;
  name: string;
  expectedBotState: 'WARM_INTRO' | 'SLOT_OFFER';
  triggerPoint: 'warm_intro' | 'slot_offer';
  attempt?: number;
};

type WaInactivityJobData = {
  leadId: string;
  phone: string;
  state: string;
  knownName: string;
  collectedFields: string;
  missingFields: string;
};

type WaInactivityJobData = {
  leadId: string;
  phone: string;
  state: string;
  knownName: string;
  collectedFields: string;
  missingFields: string;
  /** ISO timestamp of last session update — worker aborts if session was updated after this */
  sessionUpdatedAt: string;
};

function toVapiTrigger(tp: 'warm_intro' | 'slot_offer'): VoiceTriggerPoint {
  return tp === 'warm_intro' ? 'intro_no_response' : 'slot_no_response';
}

function readinessBandLabel(lead: Lead): string {
  const b = lead.readinessBand;
  if (!b) return 'pending';
  const map: Record<string, string> = {
    franchise_ready: 'Franchise Ready',
    recruitment_only: 'Recruitment Only',
    not_ready: 'Not Ready',
  };
  return map[b] ?? String(b);
}

async function schedulePostDispatchEnrichment(leadId: string, callId: string) {
  let q: Queue | null = null;
  try {
    const conn = getSingletonBullConnection();
    q = new Queue('voice-fallback', { connection: conn });
    const safeId = String(callId).replace(/[^A-Za-z0-9_\-]/g, '_');
    for (let i = 0; i < 5; i++) {
      await q.add(
        'vaani-enrich-call',
        { leadId, callId, attempt: i + 1 },
        {
          delay: 30_000 + i * 45_000,
          jobId: `vaani_enrich_${safeId}_${i + 1}`,
          removeOnComplete: true,
          attempts: 1,
        },
      );
    }
  } catch (e) {
    console.warn('[voice-fallback] schedule Vaani enrich', e);
  } finally {
    if (q) await q.close();
  }
}

async function run() {
  const app = await NestFactory.createApplicationContext(VoiceFallbackWorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  const voiceAgent = app.get(VoiceAgentService);
  const vaani = app.get(VaaniService);
  const calendar = app.get(CalendarService);
  const settingsService = app.get(SettingsService);
  const activities = app.get(ActivitiesService);
  const nurtureQueue = app.get(NurtureQueueService);
  const leadModel = app.get<Model<LeadDocument>>(getModelToken(Lead.name));
  const geminiVoice = app.get(GeminiVoiceScoringService);
  const voicePipelineSync = app.get(VoicePipelineSyncService);
  const voiceAdHoc = app.get(VoiceAdHocCalendarService);

  const connection = createBullConnection('voice-fallback-worker');

  const worker = new Worker(
    'voice-fallback',
    async (job) => {
      const data = job.data as FallbackJobData & { callId?: string; attempt?: number };
      const jobName = job.name ?? '';

      if (jobName === 'vaani-enrich-call' && data.leadId && data.callId) {
        const er = await applyVoiceEnrichmentFromVaaniApis(
          leadModel,
          vaani,
          data.leadId,
          data.callId,
        );
        if (er === 'updated') {
          const g = await geminiVoice.applyFromVoiceEnrichment(data.leadId, data.callId);
          if (g === 'applied') {
            console.log(
              '[voice-fallback] Gemini scorecard applied',
              data.leadId,
              data.callId,
            );
          }
          await voicePipelineSync.afterVoiceDataSaved(data.leadId, data.callId);
          await voiceAdHoc.tryBookFromVoice(data.leadId, data.callId);
        }
        return;
      }

      // ── WhatsApp inactivity follow-up call ────────────────────────────
      if (jobName === 'wa-inactivity-call') {
        const d = data as WaInactivityJobData;
        if (!d.leadId || !d.phone) return;
        if (d.state === 'DONE' || d.state === 'WELCOME') return;

        const lead = await leadModel.findById(d.leadId).exec();
        if (!lead?.phone) return;

        // Guard: skip if a wa_inactivity call was already made in the last 30 min
        const THIRTY_MIN = 30 * 60 * 1000;
        const recentCall = lead.voiceCalls?.find(
          (vc) =>
            (vc as Record<string, unknown>)['triggerReason'] === 'wa_inactivity' &&
            new Date(String((vc as Record<string, unknown>)['triggeredAt'])).getTime() >
              Date.now() - THIRTY_MIN,
        );
        if (recentCall) {
          console.log(`[wa-inactivity] Already called ${d.leadId} recently, skipping`);
          return;
        }

        // Guard: check the freddy session is still mid-flow
        const db = leadModel.db;
        const { Types } = await import('mongoose');
        let leadOid: InstanceType<typeof Types.ObjectId> | null = null;
        try {
          leadOid = new Types.ObjectId(d.leadId);
        } catch {
          return;
        }
        const session = await db
          .collection('freddy_sessions')
          .findOne({ lead_id: leadOid });
        const currentState = String(session?.state ?? d.state);
        if (currentState === 'DONE') {
          console.log(`[wa-inactivity] Session DONE for ${d.leadId}, skipping`);
          return;
        }

        const vaaniCfg = await vaani.getConfig();
        if (!vaaniCfg) {
          console.warn('[wa-inactivity] Vaani not configured, skipping call');
          return;
        }

        const appSettings = await settingsService.getSettings();
        const companyName =
          appSettings?.branding?.companyName?.trim() ||
          process.env.COMPANY_NAME ||
          'Franchise Ready';

        // Fetch live slots and cache them so vaani-confirm-slot can book instantly
        let slotsString = '';
        try {
          const slots = await calendar.getAvailableSlots('voice', 3);
          await calendar.cacheVoiceSlots(d.leadId, slots);
          slotsString = slots.map((s) => `Option ${s.index}: ${s.label}`).join(', ');
        } catch (e) {
          console.warn('[wa-inactivity] Could not fetch slots (calendar not configured?)', e);
        }

        const { callId, dispatchId } = await vaani.triggerCall({
          leadId: d.leadId,
          contactNumber: lead.phone.replace(/\s/g, ''),
          leadName: d.knownName || lead.name,
          triggerReason: 'wa_inactivity',
          readinessScore: lead.totalScore ?? lead.score ?? 0,
          readinessBand: readinessBandLabel(lead),
          availableSlots: slotsString,
          companyName,
          collectedFields: d.collectedFields,
          missingFields: d.missingFields,
        });

        const vc: Record<string, unknown> = {
          vaaniCallId: callId,
          triggeredAt: new Date(),
          triggerReason: 'wa_inactivity',
          status: 'initiated',
        };
        if (dispatchId) vc['vaaniDispatchId'] = dispatchId;
        await leadModel.findByIdAndUpdate(d.leadId, { $push: { voiceCalls: vc } });

        await activities.logVoiceCall(
          d.leadId,
          d.knownName || lead.name,
          `Vaani outbound call triggered — WhatsApp inactivity follow-up (missing: ${d.missingFields || 'details'})`,
        );

        void schedulePostDispatchEnrichment(d.leadId, callId);
        console.log(`[wa-inactivity] Vaani call dispatched for ${d.leadId} (${callId})`);
        return;
      }

      if (
        jobName !== 'voice-fallback' &&
        jobName !== 'VOICE_FOLLOWUP' &&
        jobName !== 'voice-fallback-retry' &&
        jobName !== 'voice-callback'
      ) {
        return;
      }

      const isInitial = jobName === 'voice-fallback' || jobName === 'VOICE_FOLLOWUP';
      const isFollowUp =
        jobName === 'voice-fallback-retry' || jobName === 'voice-callback';

      if (isInitial) {
        const lead = await leadModel.findById(data.leadId).exec();
        if (!lead?.phone) return;
        if (lead.botState !== data.expectedBotState) return;
        if (lead.discoveryCall?.status === 'scheduled') return;

        const appSettings = await settingsService.getSettings();
        const maxAttempts = Math.min(5, Math.max(1, appSettings?.maxVoiceAttempts ?? 2));
        if ((lead.voiceCalls?.length ?? 0) >= maxAttempts) {
          await leadModel.findByIdAndUpdate(lead._id, {
            $set: { stage: 'Gap Nurture', track: 'Not Ready' },
          });
          await nurtureQueue.enqueue20DayDrip({
            leadId: String(lead._id),
            phone: lead.phone,
            name: lead.name,
          });
          return;
        }

        const vaaniCfg = await vaani.getConfig();
        if (vaaniCfg) {
          let slots: Awaited<ReturnType<CalendarService['getAvailableSlots']>>;
          try {
            slots = await calendar.getAvailableSlots('voice', 3);
          } catch {
            return;
          }
          await calendar.cacheVoiceSlots(String(lead._id), slots);
          const slotsString = slots
            .map((s) => `Option ${s.index}: ${s.label}`)
            .join(', ');
          const companyName =
            appSettings?.branding?.companyName?.trim() ||
            process.env.COMPANY_NAME ||
            'Franchise Ready';
          const { callId, dispatchId } = await vaani.triggerCall({
            leadId: String(lead._id),
            contactNumber: lead.phone.replace(/\s/g, ''),
            leadName: lead.name,
            triggerReason: toVapiTrigger(data.triggerPoint),
            readinessScore: lead.totalScore ?? lead.score ?? 0,
            readinessBand: readinessBandLabel(lead),
            availableSlots: slotsString,
            companyName,
          });

          const vc: Record<string, unknown> = {
            vaaniCallId: callId,
            triggeredAt: new Date(),
            triggerReason: toVapiTrigger(data.triggerPoint),
            status: 'initiated',
          };
          if (dispatchId) vc['vaaniDispatchId'] = dispatchId;
          await leadModel.findByIdAndUpdate(lead._id, { $push: { voiceCalls: vc } });
          void schedulePostDispatchEnrichment(String(lead._id), callId);
          await activities.logVoiceCall(
            String(lead._id),
            lead.name,
            `Vaani outbound call triggered (${data.triggerPoint})`,
          );
          return;
        }

        await voiceAgent.initiateCall(lead, toVapiTrigger(data.triggerPoint));
        return;
      }

      if (isFollowUp) {
        const lead = await leadModel.findById(data.leadId).exec();
        if (!lead?.phone) return;
        if (data.expectedBotState && lead.botState !== data.expectedBotState) {
          return;
        }
        const tp = data.triggerPoint
          ? toVapiTrigger(data.triggerPoint)
          : 'slot_no_response';

        const vaaniCfg = await vaani.getConfig();
        if (vaaniCfg) {
          const appSettings = await settingsService.getSettings();
          let slots: Awaited<ReturnType<CalendarService['getAvailableSlots']>>;
          try {
            slots = await calendar.getAvailableSlots('voice', 3);
          } catch {
            return;
          }
          await calendar.cacheVoiceSlots(String(lead._id), slots);
          const slotsString = slots
            .map((s) => `Option ${s.index}: ${s.label}`)
            .join(', ');
          const companyName =
            appSettings?.branding?.companyName?.trim() ||
            process.env.COMPANY_NAME ||
            'Franchise Ready';
          const { callId, dispatchId } = await vaani.triggerCall({
            leadId: String(lead._id),
            contactNumber: lead.phone.replace(/\s/g, ''),
            leadName: lead.name,
            triggerReason: tp,
            readinessScore: lead.totalScore ?? lead.score ?? 0,
            readinessBand: readinessBandLabel(lead),
            availableSlots: slotsString,
            companyName,
          });
          const vc2: Record<string, unknown> = {
            vaaniCallId: callId,
            triggeredAt: new Date(),
            triggerReason: tp,
            status: 'initiated',
          };
          if (dispatchId) vc2['vaaniDispatchId'] = dispatchId;
          await leadModel.findByIdAndUpdate(lead._id, { $push: { voiceCalls: vc2 } });
          void schedulePostDispatchEnrichment(String(lead._id), callId);
          await activities.logVoiceCall(
            String(lead._id),
            lead.name,
            `Vaani outbound call triggered (retry/callback)`,
          );
          return;
        }

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
