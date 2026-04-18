/**
 * Run after `nest build`:
 *   REDIS_URL=rediss://... MONGODB_URI=... RESEND_API_KEY=... RESEND_FROM_EMAIL=... CRM_PUBLIC_URL=... \
 *   WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_ACCESS_TOKEN=... \
 *   node dist/calendar/calendar-reminders.worker.js
 *
 * Processes `calendar-reminders` queue (REM_24H, REM_1H) scheduled by CalendarService.bookSlot.
 */
import mongoose from 'mongoose';
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { createBullConnection } from '../queues/redis-connection';
import { CalendlyRemindersAppModule } from '../calendly/calendly-reminders.app.module';
import { BriefingPrecallMailService } from '../briefing/briefing-precall-mail.service';
import type { CalendlyReminderJobData } from '../calendly/calendly-reminder.service';

type CalendarReminderJobData = { leadId: string };

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

async function sendResend(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
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

async function resolveConsultantEmail(
  db: mongoose.mongo.Db,
): Promise<string> {
  const settings = await db.collection('app_settings').findOne({});
  const raw = (settings as { availabilitySettings?: { primaryConsultantUserId?: unknown } } | null)
    ?.availabilitySettings?.primaryConsultantUserId;
  let uid: mongoose.Types.ObjectId | null = null;
  if (raw instanceof mongoose.Types.ObjectId) uid = raw;
  else if (typeof raw === 'string' && mongoose.Types.ObjectId.isValid(raw)) {
    uid = new mongoose.Types.ObjectId(raw);
  }
  if (uid) {
    const ci = await db.collection('calendar_integrations').findOne({
      userId: uid,
    });
    const em = (ci as { googleEmail?: string } | null)?.googleEmail;
    if (em) return em;
  }
  const any = await db
    .collection('calendar_integrations')
    .findOne({ isGoogleConnected: true });
  return (any as { googleEmail?: string } | null)?.googleEmail ?? '';
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');

  const app = await NestFactory.createApplicationContext(
    CalendlyRemindersAppModule,
    { logger: ['error', 'warn'] },
  );
  const briefingMail = app.get(BriefingPrecallMailService);

  const connection = createBullConnection('calendar-reminders-worker');

  const worker = new Worker<CalendarReminderJobData>(
    'calendar-reminders',
    async (job) => {
      const data = job.data;
      const db = mongoose.connection.db;
      if (!db) return;

      const lead = await db.collection('leads').findOne({
        _id: new mongoose.Types.ObjectId(data.leadId),
      });
      if (!lead) return;
      const dc = lead.discoveryCall as
        | {
            status?: string;
            scheduledAt?: Date;
            meetLink?: string;
            meetingLink?: string;
          }
        | undefined;
      if (dc?.status !== 'scheduled') return;

      const meetingLink = dc.meetLink || dc.meetingLink || '';
      const scheduledAtIso = dc.scheduledAt
        ? new Date(dc.scheduledAt).toISOString()
        : '';
      const leadName = String(lead.name ?? 'Lead');
      const leadPhone = lead.phone as string | undefined;
      const leadEmail = lead.email as string | undefined;
      const consultantEmail = await resolveConsultantEmail(db);

      const briefingPayload: CalendlyReminderJobData = {
        leadId: data.leadId,
        leadName,
        leadPhone,
        leadEmail,
        meetingLink,
        scheduledAtIso,
        consultantEmail: consultantEmail || undefined,
        kind: job.name === 'REM_24H' ? '24h' : '1h',
      };

      const when = fmt(scheduledAtIso);

      if (job.name === 'REM_24H') {
        if (leadPhone) {
          await sendWhatsAppText(
            leadPhone,
            `Just a reminder — your franchise discovery call is tomorrow at ${when}. Meeting link: ${meetingLink}. We're looking forward to speaking with you!`,
          );
        }
        if (leadEmail) {
          await sendResend(
            leadEmail,
            'Reminder: discovery call tomorrow',
            `<p>Your franchise discovery call is tomorrow at <strong>${when}</strong>.</p>
<p><a href="${meetingLink}">Meeting link</a></p>`,
          );
        }
        if (consultantEmail) {
          await sendResend(
            consultantEmail,
            `Reminder: ${leadName} — discovery tomorrow`,
            `<p>${leadName} has a franchise discovery call tomorrow at ${when}.</p>
<p><a href="${meetingLink}">Google Meet</a></p>`,
          );
        }
        const ownerId = lead.ownerId;
        if (ownerId) {
          await db.collection('notifications').insertOne({
            userId: String(ownerId),
            type: 'precall_reminder_24h',
            description: `${leadName} — discovery call tomorrow (${when}).`,
            leadId: data.leadId,
            timestamp: new Date().toISOString(),
            read: false,
          });
        }
      }

      if (job.name === 'REM_1H') {
        if (leadPhone) {
          await sendWhatsAppText(
            leadPhone,
            `Your discovery call starts in 1 hour! Join here: ${meetingLink}`,
          );
        }
        if (consultantEmail) {
          await briefingMail.send1hBriefingEmail({
            ...briefingPayload,
            kind: '1h',
          });
        }
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error('[calendar-reminders] job failed', job?.id, err);
  });

  console.log('[calendar-reminders] worker listening');
}

void run().catch((e) => {
  console.error(e);
  process.exit(1);
});
