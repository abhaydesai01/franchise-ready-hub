/**
 * Run: `npm run worker:sequence` from the `crm/` directory (requires Redis + Mongo env).
 */
import '../load-worker-env';
import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { createBullConnection } from '../connection';
import { enqueueScoringNudgeRound2, enqueueVoiceAgentCall } from '../index';
import { Lead } from '../../../models/Lead';
import { BotSession } from '../../../models/BotSession';
import { AutomationLog } from '../../../models/AutomationLog';
import { sendText, sendBotTemplate, formatPhone } from '../../whatsapp';
import { templates, isTemplateInteractive, type TemplateMessage } from '../../bot/templates';

type NurtureTemplateKey =
  | 'nurtureDay1'
  | 'nurtureDay3'
  | 'nurtureDay7'
  | 'nurtureDay14'
  | 'nurtureDay20';

function skipNurture(stage: string | undefined): boolean {
  if (!stage) return false;
  const s = stage.toLowerCase();
  return (
    s === 'dead' ||
    s === 'discovery_booked' ||
    s === 'signed' ||
    s === 'convert_consulting'
  );
}

function skipBooking(stage: string | undefined): boolean {
  if (!stage) return false;
  const s = stage.toLowerCase();
  return s === 'dead' || s === 'booked' || s === 'signed';
}

function nurtureMessage(name: string, key: NurtureTemplateKey): TemplateMessage {
  switch (key) {
    case 'nurtureDay1':
      return templates.nurtureDay1(name);
    case 'nurtureDay3':
      return templates.nurtureDay3(name);
    case 'nurtureDay7':
      return templates.nurtureDay7(name);
    case 'nurtureDay14':
      return templates.nurtureDay14(name);
    case 'nurtureDay20':
      return templates.nurtureDay20(name);
    default:
      return templates.nurtureDay1(name);
  }
}

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is required (set in crm/.env.local)');
    process.exit(1);
  }

  // BullMQ workers must not share one ioredis connection (blocking reads).
  // Use independent sockets per worker for stable Upstash behavior.
  const workerConnection = (label: string) => createBullConnection(label);

  await mongoose.connect(MONGODB_URI);

  const nurtureWorker = new Worker(
    'nurture-sequence',
    async (job) => {
      const { leadId, phone, name, templateKey } = job.data as {
        leadId: string;
        phone: string;
        name: string;
        templateKey: NurtureTemplateKey;
      };

      const lead = await Lead.findById(leadId).lean();
      if (!lead) throw new Error('Lead not found');

      const session = await BotSession.findOne({ phone: formatPhone(phone) }).lean();
      if (session?.optedOut) return;
      if (skipNurture(lead.stage)) return;

      const msg = nurtureMessage(name, templateKey);
      const res =
        msg.type === 'text'
          ? await sendText(phone, msg.text)
          : await sendBotTemplate(phone, msg);

      if (!res.success) throw new Error(res.error ?? 'send failed');

      let content: string;
      if (isTemplateInteractive(msg)) {
        content = JSON.stringify(msg.interactive);
      } else {
        content = msg.text;
      }

      await AutomationLog.create({
        leadId: new mongoose.Types.ObjectId(leadId),
        sequenceName: 'gap-nurture-20day',
        stepName: templateKey,
        channel: 'whatsapp',
        direction: 'outbound',
        status: 'sent',
        content,
        waMessageId: res.messageId ?? undefined,
        jobId: String(job.id),
        sentAt: new Date(),
      });
    },
    { connection: workerConnection('worker:nurture-sequence'), concurrency: 5 },
  );

  nurtureWorker.on('failed', (job, err) => {
    console.error('[nurture-sequence] job failed', job?.id, err);
  });

  const bookingWorker = new Worker(
    'booking-sequence',
    async (job) => {
      const { leadId, phone, name, kind, calLink } = job.data as {
        leadId: string;
        phone: string;
        name: string;
        kind: 'send_link' | 'reminder_24h' | 'reminder_48h';
        calLink: string;
      };

      const lead = await Lead.findById(leadId).lean();
      if (!lead) throw new Error('Lead not found');

      const session = await BotSession.findOne({ phone: formatPhone(phone) }).lean();
      if (session?.optedOut) return;
      if (skipBooking(lead.stage)) return;

      let text: string;
      if (kind === 'send_link') {
        const tpl = templates.sendBookingLink(name, calLink);
        text = tpl.text;
      } else if (kind === 'reminder_24h') {
        text = `${name}, friendly reminder: book your Franchise Ready discovery call here: ${calLink}`;
      } else {
        text = `${name}, we still have slots open for discovery — grab yours here: ${calLink}`;
      }

      const res = await sendText(phone, text);
      if (!res.success) throw new Error(res.error ?? 'send failed');

      await AutomationLog.create({
        leadId: new mongoose.Types.ObjectId(leadId),
        sequenceName: 'discovery-booking',
        stepName: kind,
        channel: 'whatsapp',
        direction: 'outbound',
        status: 'sent',
        content: text,
        waMessageId: res.messageId ?? undefined,
        jobId: String(job.id),
        sentAt: new Date(),
      });
    },
    { connection: workerConnection('worker:booking-sequence'), concurrency: 5 },
  );

  bookingWorker.on('failed', (job, err) => {
    console.error('[booking-sequence] job failed', job?.id, err);
  });

  const whatsappOutWorker = new Worker(
    'whatsapp-out',
    async (job) => {
      const { leadId, phone, text } = job.data as { leadId: string; phone: string; text: string };
      const res = await sendText(phone, text);
      if (!res.success) throw new Error(res.error ?? 'send failed');
      await AutomationLog.create({
        leadId: new mongoose.Types.ObjectId(leadId),
        stepName: 'queued-text',
        channel: 'whatsapp',
        direction: 'outbound',
        status: 'sent',
        content: text,
        waMessageId: res.messageId ?? undefined,
        jobId: String(job.id),
        sentAt: new Date(),
      });
    },
    { connection: workerConnection('worker:whatsapp-out'), concurrency: 5 },
  );

  whatsappOutWorker.on('failed', (job, err) => {
    console.error('[whatsapp-out] job failed', job?.id, err);
  });

  const scoringNudgeWorker = new Worker(
    'scoring-nudge',
    async (job) => {
      const { phone, sessionId, expectedState, round, leadId } = job.data as {
        phone: string;
        sessionId: string;
        expectedState: string;
        round: 1 | 2;
        leadId?: string;
      };

      const session = await BotSession.findById(sessionId).lean();
      if (!session || session.optedOut) return;
      if (session.lastIntent && session.lastIntent !== expectedState) return;

      const nudgeMsg = templates.scoringNudgeSoft(round);
      const res = await sendText(phone, nudgeMsg.text);
      if (!res.success) throw new Error(res.error ?? 'nudge send failed');

      if (leadId) {
        await AutomationLog.create({
          leadId: new mongoose.Types.ObjectId(leadId),
          sequenceName: 'scoring-nudge',
          stepName: `nudge-r${round}`,
          channel: 'whatsapp',
          direction: 'outbound',
          status: 'sent',
          content: nudgeMsg.text,
          waMessageId: res.messageId ?? undefined,
          jobId: String(job.id),
          sentAt: new Date(),
        });
      }

      if (round === 1) {
        await enqueueScoringNudgeRound2(phone, sessionId, expectedState, leadId);
      } else {
        await BotSession.updateOne({ _id: sessionId }, { $inc: { retryCount: 1 } });
        if (leadId) {
          const name = session.collectedName ?? 'there';
          await enqueueVoiceAgentCall({
            leadId,
            phone: formatPhone(phone),
            name,
            reason: 'scoring_nudge_exhausted',
          });
        }
      }
    },
    { connection: workerConnection('worker:scoring-nudge'), concurrency: 5 },
  );

  scoringNudgeWorker.on('failed', (job, err) => {
    console.error('[scoring-nudge] job failed', job?.id, err);
  });

  const voiceAgentWorker = new Worker(
    'voice-out',
    async (job) => {
      if (job.name !== 'voice-agent') return;
      const { leadId, phone, name, reason } = job.data as {
        leadId: string;
        phone: string;
        name: string;
        reason: string;
      };

      await AutomationLog.create({
        leadId: new mongoose.Types.ObjectId(leadId),
        sequenceName: 'voice-escalation',
        stepName: 'voice_agent_call',
        channel: 'voice',
        direction: 'outbound',
        status: 'pending',
        content: `Voice agent follow-up requested for ${name} (${formatPhone(phone)}). Reason: ${reason}. Assign in your dialer / voice platform.`,
        jobId: String(job.id),
        sentAt: new Date(),
      });
    },
    { connection: workerConnection('worker:voice-out'), concurrency: 3 },
  );

  voiceAgentWorker.on('failed', (job, err) => {
    console.error('[voice-out] voice-agent job failed', job?.id, err);
  });

  console.log(
    'Workers running: nurture-sequence, booking-sequence, whatsapp-out, scoring-nudge, voice-out (voice-agent)',
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
