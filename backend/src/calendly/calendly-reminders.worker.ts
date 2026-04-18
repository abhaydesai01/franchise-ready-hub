/**
 * Run after `nest build`:
 *   REDIS_URL=rediss://... MONGODB_URI=... RESEND_API_KEY=... RESEND_FROM_EMAIL=... CRM_PUBLIC_URL=... \
 *   WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_ACCESS_TOKEN=... \
 *   node dist/calendly/calendly-reminders.worker.js
 */
import mongoose from 'mongoose';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { createBullConnection } from '../queues/redis-connection';
import { CalendlyRemindersAppModule } from './calendly-reminders.app.module';
import { BriefingPrecallMailService } from '../briefing/briefing-precall-mail.service';

type ReminderJobData = {
  leadId: string;
  leadName: string;
  leadPhone?: string;
  leadEmail?: string;
  meetingLink: string;
  scheduledAtIso: string;
  consultantEmail?: string;
  kind: '24h' | '1h';
};

const GRAPH_VERSION = 'v19.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function formatPhone(phone: string): string {
  const raw = phone.trim().replace(/^\+/, '');
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.startsWith('91')) return digits;
  return digits;
}

async function sendWhatsAppText(toPhone: string, body: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  if (!phoneNumberId || !token) return;
  await fetch(`${BASE}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formatPhone(toPhone),
      type: 'text',
      text: { preview_url: true, body: body.slice(0, 4096) },
    }),
  });
}

async function sendResend(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY ?? '';
  if (!key) return;
  const from = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');

  const app = await NestFactory.createApplicationContext(CalendlyRemindersAppModule, {
    logger: ['error', 'warn'],
  });
  const briefingMail = app.get(BriefingPrecallMailService);

  const connection = createBullConnection('calendly-reminders-worker');

  const worker = new Worker<ReminderJobData>(
    'calendly-reminders',
    async (job) => {
      const data = job.data;
      const db = mongoose.connection.db;
      if (!db) return;
      const lead = await db.collection('leads').findOne({
        _id: new mongoose.Types.ObjectId(data.leadId),
      });
      if (!lead) return;
      const dc = lead.discoveryCall as { status?: string } | undefined;
      if (dc?.status === 'cancelled') return;

      const when = fmt(data.scheduledAtIso);
      const link = data.meetingLink || '';

      if (data.kind === '24h') {
        if (data.leadPhone) {
          await sendWhatsAppText(
            data.leadPhone,
            `Just a reminder — your franchise discovery call is tomorrow at ${when}. Meeting link: ${link}. We're looking forward to speaking with you!`,
          );
        }
        if (data.leadEmail) {
          await sendResend(
            data.leadEmail,
            'Reminder: discovery call tomorrow',
            `<p>Your franchise discovery call is tomorrow at <strong>${when}</strong>.</p>
<p><a href="${link}">Meeting link</a></p>`,
          );
        }
        if (data.consultantEmail) {
          await sendResend(
            data.consultantEmail,
            `Reminder: ${data.leadName} — discovery tomorrow`,
            `<p>${data.leadName} has a discovery call tomorrow at ${when}.</p>`,
          );
        }
        const ownerId = lead.ownerId;
        if (ownerId) {
          await db.collection('notifications').insertOne({
            userId: String(ownerId),
            type: 'precall_reminder_24h',
            description: `${data.leadName} — discovery call tomorrow (${when}).`,
            leadId: data.leadId,
            timestamp: new Date().toISOString(),
            read: false,
          });
        }
      }

      if (data.kind === '1h') {
        if (data.leadPhone) {
          await sendWhatsAppText(
            data.leadPhone,
            `Your discovery call starts in 1 hour! Join here: ${link}`,
          );
        }
        if (data.consultantEmail) {
          await briefingMail.send1hBriefingEmail({
            leadId: data.leadId,
            leadName: data.leadName,
            leadPhone: data.leadPhone,
            leadEmail: data.leadEmail,
            meetingLink: data.meetingLink,
            scheduledAtIso: data.scheduledAtIso,
            consultantEmail: data.consultantEmail,
            kind: '1h',
          });
        }
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error('[calendly-reminders] job failed', job?.id, err);
  });

  console.log('[calendly-reminders] worker listening');
}

void run().catch((e) => {
  console.error(e);
  process.exit(1);
});
