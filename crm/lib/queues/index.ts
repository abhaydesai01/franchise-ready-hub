import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { createBullConnection } from './connection';

let _redis: Redis | null = null;
function redis(): Redis {
  if (!_redis) {
    _redis = createBullConnection('queue-producer');
  }
  return _redis;
}

let _whatsapp: Queue | null = null;
let _nurture: Queue | null = null;
let _booking: Queue | null = null;
let _voice: Queue | null = null;
let _voiceFallback: Queue | null = null;
let _scoringNudge: Queue | null = null;
let _documentGeneration: Queue | null = null;
let _proposalFollowup: Queue | null = null;

export function whatsappQueue(): Queue {
  if (!_whatsapp) _whatsapp = new Queue('whatsapp-out', { connection: redis() });
  return _whatsapp;
}

export function nurtureQueue(): Queue {
  if (!_nurture) _nurture = new Queue('nurture-sequence', { connection: redis() });
  return _nurture;
}

export function bookingQueue(): Queue {
  if (!_booking) _booking = new Queue('booking-sequence', { connection: redis() });
  return _booking;
}

export function voiceQueue(): Queue {
  if (!_voice) _voice = new Queue('voice-out', { connection: redis() });
  return _voice;
}

/** 30m VAPI voice fallback (separate from `voice-out` scoring escalation). */
export function voiceFallbackQueue(): Queue {
  if (!_voiceFallback) {
    _voiceFallback = new Queue('voice-fallback', { connection: redis() });
  }
  return _voiceFallback;
}

export function scoringNudgeQueue(): Queue {
  if (!_scoringNudge) _scoringNudge = new Queue('scoring-nudge', { connection: redis() });
  return _scoringNudge;
}

export function documentGenerationQueue(): Queue {
  if (!_documentGeneration) {
    _documentGeneration = new Queue('document-generation', { connection: redis() });
  }
  return _documentGeneration;
}

export function proposalFollowupQueue(): Queue {
  if (!_proposalFollowup) {
    _proposalFollowup = new Queue('proposal-followup', { connection: redis() });
  }
  return _proposalFollowup;
}

const MS_2H = 2 * 60 * 60 * 1000;
const MS_DAY = 24 * 60 * 60 * 1000;

export type ScoringNudgeJobData = {
  phone: string;
  sessionId: string;
  expectedState: string;
  round: 1 | 2;
  leadId?: string;
};

/** After sending a scoring question, queue first nudge in 2 hours. */
export async function enqueueScoringQuestionNudge(
  phone: string,
  sessionId: string,
  expectedState: string,
  leadId?: string,
): Promise<void> {
  const q = scoringNudgeQueue();
  await q.add(
    'scoring-nudge',
    { phone, sessionId, expectedState, round: 1 as const, leadId } satisfies ScoringNudgeJobData,
    {
      delay: MS_2H,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      jobId: `nudge-${sessionId}-${expectedState}-r1`,
    },
  );
}

export async function enqueueScoringNudgeRound2(
  phone: string,
  sessionId: string,
  expectedState: string,
  leadId?: string,
): Promise<void> {
  const q = scoringNudgeQueue();
  await q.add(
    'scoring-nudge',
    { phone, sessionId, expectedState, round: 2 as const, leadId } satisfies ScoringNudgeJobData,
    {
      delay: MS_2H,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      jobId: `nudge-${sessionId}-${expectedState}-r2`,
    },
  );
}

export type VoiceAgentJobData = {
  leadId: string;
  phone: string;
  name: string;
  reason: string;
};

export async function enqueueVoiceAgentCall(data: VoiceAgentJobData): Promise<void> {
  const q = voiceQueue();
  await q.add(
    'voice-agent',
    data,
    {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10_000 },
      jobId: `voice-agent-${data.leadId}-${Date.now()}`,
    },
  );
}

const MS_30M = 30 * 60 * 1000;

/** Trigger segment for job id `voice_fallback_${leadId}_${triggerPoint}`. */
export type VoiceFallbackTriggerPoint = 'warm_intro' | 'slot_offer';

/** 30-minute voice fallback if lead is still in expectedBotState (warm intro or slot offer). */
export type VoiceFallbackJobData = {
  leadId: string;
  phone: string;
  name: string;
  expectedBotState: 'WARM_INTRO' | 'SLOT_OFFER';
  /** Mirrors queue suffix: warm_intro | slot_offer */
  triggerPoint: VoiceFallbackTriggerPoint;
};

function triggerPointFromBotState(
  s: 'WARM_INTRO' | 'SLOT_OFFER',
): VoiceFallbackTriggerPoint {
  return s === 'WARM_INTRO' ? 'warm_intro' : 'slot_offer';
}

export function voiceFallbackJobId(
  leadId: string,
  triggerPoint: VoiceFallbackTriggerPoint,
): string {
  return `voice_fallback_${leadId}_${triggerPoint}`;
}

export async function enqueueVoiceFallback30m(
  data: Omit<VoiceFallbackJobData, 'triggerPoint'> & {
    expectedBotState: 'WARM_INTRO' | 'SLOT_OFFER';
  },
): Promise<void> {
  const triggerPoint = triggerPointFromBotState(data.expectedBotState);
  const q = voiceFallbackQueue();
  await q.add(
    'voice-fallback',
    { ...data, triggerPoint },
    {
      delay: MS_30M,
      attempts: 2,
      backoff: { type: 'exponential', delay: 10_000 },
      jobId: voiceFallbackJobId(data.leadId, triggerPoint),
    },
  );
}

/** Cancel pending 30m voice fallback (exact BullMQ job id). */
export async function cancelVoiceFallbackJob(
  leadId: string,
  triggerPoint: VoiceFallbackTriggerPoint,
): Promise<void> {
  const q = voiceFallbackQueue();
  const id = voiceFallbackJobId(leadId, triggerPoint);
  try {
    const job = await q.getJob(id);
    if (job) await job.remove();
  } catch (e) {
    console.error('[queues] cancelVoiceFallbackJob', id, e);
  } finally {
    await q.close();
  }
}

export type NurtureTemplateKey =
  | 'nurtureDay1'
  | 'nurtureDay3'
  | 'nurtureDay7'
  | 'nurtureDay14'
  | 'nurtureDay20';

const NURTURE_DAYS = [1, 3, 7, 14, 20] as const;
const NURTURE_KEYS: NurtureTemplateKey[] = [
  'nurtureDay1',
  'nurtureDay3',
  'nurtureDay7',
  'nurtureDay14',
  'nurtureDay20',
];

export async function enqueueNurtureSequence(
  leadId: string,
  phone: string,
  name: string,
  opts?: { delayMs?: number },
): Promise<void> {
  const q = nurtureQueue();
  const base = opts?.delayMs ?? 10 * 60 * 1000;
  for (let i = 0; i < NURTURE_DAYS.length; i++) {
    const day = NURTURE_DAYS[i];
    const delay = base + day * MS_DAY;
    const templateKey = NURTURE_KEYS[i];
    await q.add(
      'nurture-step',
      { leadId, phone, name, step: day, templateKey },
      {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        jobId: `nurture-${leadId}-day${day}`,
      },
    );
  }
}

export async function enqueueDiscoveryBookingSequence(
  leadId: string,
  phone: string,
  name: string,
  opts?: { delayMs?: number },
): Promise<void> {
  const q = bookingQueue();
  const base = opts?.delayMs ?? 2 * 60 * 1000;
  const calLink = `https://cal.com/franchise-ready/discovery?lead=${encodeURIComponent(leadId)}`;

  await q.add(
    'booking-step',
    { leadId, phone, name, kind: 'send_link' as const, calLink },
    {
      delay: base,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      jobId: `booking-${leadId}-send_link`,
    },
  );

  await q.add(
    'booking-step',
    { leadId, phone, name, kind: 'reminder_24h' as const, calLink },
    {
      delay: base + MS_DAY,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      jobId: `booking-${leadId}-reminder_24h`,
    },
  );

  await q.add(
    'booking-step',
    { leadId, phone, name, kind: 'reminder_48h' as const, calLink },
    {
      delay: base + 2 * MS_DAY,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      jobId: `booking-${leadId}-reminder_48h`,
    },
  );
}

export async function enqueueWhatsAppMessage(
  leadId: string,
  phone: string,
  text: string,
  delayMs = 0,
): Promise<void> {
  const q = whatsappQueue();
  await q.add(
    'send-text',
    { leadId, phone, text },
    {
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      jobId: `wa-text-${leadId}-${Date.now()}`,
    },
  );
}

export async function cancelSessionScoringNudges(sessionId: string): Promise<void> {
  const q = scoringNudgeQueue();
  const jobs = await q.getJobs(['delayed', 'waiting', 'paused']);
  for (const job of jobs) {
    const data = job.data as { sessionId?: string };
    if (data.sessionId && String(data.sessionId) === sessionId) {
      try {
        await job.remove();
      } catch (e) {
        console.error('[queues] remove nudge job failed', job.id, e);
      }
    }
  }
}

let _calendlyReminders: Queue | null = null;
function calendlyRemindersQueue(): Queue {
  if (!_calendlyReminders) {
    _calendlyReminders = new Queue('calendly-reminders', { connection: redis() });
  }
  return _calendlyReminders;
}

export async function cancelLeadJobs(leadId: string): Promise<void> {
  const queues = [
    nurtureQueue(),
    bookingQueue(),
    voiceQueue(),
    voiceFallbackQueue(),
    whatsappQueue(),
    scoringNudgeQueue(),
    calendlyRemindersQueue(),
    documentGenerationQueue(),
    proposalFollowupQueue(),
  ];
  for (const q of queues) {
    const jobs = await q.getJobs(['delayed', 'waiting', 'paused']);
    for (const job of jobs) {
      const data = job.data as { leadId?: string };
      if (data.leadId && String(data.leadId) === leadId) {
        try {
          await job.remove();
        } catch (e) {
          console.error('[queues] remove job failed', job.id, e);
        }
      }
    }
  }
}
