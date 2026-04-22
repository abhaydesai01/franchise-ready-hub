/**
 * Runs webhook-shaped E2E checks for Freddy v2 scenarios 9-14.
 * Usage: FREDDY_V2_ENABLED=true FREDDY_V2_ROLLOUT_PERCENT=100 npx tsx scripts/freddy-v2-e2e.ts
 */
import crypto from 'crypto';
import assert from 'node:assert/strict';
import { connectDB } from '../lib/mongodb';
import { processWhatsAppPayload } from '../lib/webhooks/processWhatsApp';
import { BotSession } from '../models/BotSession';
import { Lead } from '../models/Lead';
import mongoose from 'mongoose';

type Scenario = {
  id: string;
  phone: string;
  text: string;
  assertFn: (ctx: { session: Record<string, any> | null; lead: Record<string, any> | null }) => void;
};

function waPayload(phone: string, msgId: string, text: string): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: phone,
                  id: msgId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

function signature(body: string): string {
  const secret = process.env.META_APP_SECRET || 'freddy-e2e-secret';
  process.env.META_APP_SECRET = secret;
  return `sha256=${crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

async function pause(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runInbound(phone: string, msgId: string, text: string): Promise<void> {
  const body = waPayload(phone, msgId, text);
  const ok = await processWhatsAppPayload(body, signature(body));
  assert.equal(ok, true);
  await pause(1500);
}

async function fetchState(phone: string) {
  const session = (await BotSession.findOne({ phone }).lean()) as Record<string, any> | null;
  const lead = (await Lead.findOne({ phone }).lean()) as Record<string, any> | null;
  return { session, lead };
}

async function clearPhone(phone: string): Promise<void> {
  const lead = await Lead.findOne({ phone }).lean();
  if (lead?._id) {
    await BotSession.deleteMany({ leadId: lead._id });
  }
  await BotSession.deleteMany({ phone });
  await Lead.deleteMany({ phone });
}

async function main() {
  process.env.FREDDY_V2_ENABLED = process.env.FREDDY_V2_ENABLED ?? 'true';
  process.env.FREDDY_V2_ROLLOUT_PERCENT = process.env.FREDDY_V2_ROLLOUT_PERCENT ?? '100';
  await connectDB();

  const scenarios: Scenario[] = [
    {
      id: '9_passive_experience_location',
      phone: '919990000009',
      text: "I've been running 3 Kirana stores for 7 years",
      assertFn: ({ session }) => {
        assert.ok(session);
        assert.equal(session?.goalTracker?.score_experience, 20);
        assert.equal(session?.goalTracker?.score_location, 15);
        assert.ok(session?.scoringEvidence?.experience);
        assert.ok(session?.scoringEvidence?.location);
      },
    },
    {
      id: '10_ready_to_book_signal',
      phone: '919990000010',
      text: 'this sounds great, what do I do next?',
      assertFn: ({ session }) => {
        assert.ok(session);
        assert.equal(session?.lastIntent, 'signal_ready_to_book');
      },
    },
    {
      id: '11_faq_cost_plus_capital',
      phone: '919990000011',
      text: 'what is the cost? I have about ₹40 lakhs to invest',
      assertFn: ({ session }) => {
        assert.ok(session);
        assert.equal(session?.lastIntent, 'faq_cost');
        assert.ok((session?.goalTracker?.score_capital ?? 0) > 0);
        assert.ok(session?.scoringEvidence?.capital);
      },
    },
    {
      id: '12_frustration_signal',
      phone: '919990000012',
      text: "I'm frustrated, you keep asking the same things",
      assertFn: ({ session, lead }) => {
        assert.ok(session);
        assert.equal(session?.lastIntent, 'frustration_signal');
        assert.ok(lead?.notes?.includes('frustration'));
      },
    },
    {
      id: '13_ready_to_book_ask_start',
      phone: '919990000013',
      text: 'this is so useful! who do I speak to about getting started?',
      assertFn: ({ session }) => {
        assert.ok(session);
        assert.equal(session?.lastIntent, 'signal_ready_to_book');
      },
    },
    {
      id: '14_full_passive_organic',
      phone: '919990000014',
      text: 'We have run this business for 8 years, now 4 outlets, around ₹30 lakhs ready, we are serious and want to start next month.',
      assertFn: ({ session }) => {
        assert.ok(session);
        assert.ok((session?.goalTracker?.score_experience ?? 0) > 0);
        assert.ok((session?.goalTracker?.score_location ?? 0) > 0);
        assert.ok((session?.goalTracker?.score_capital ?? 0) > 0);
        assert.ok((session?.goalTracker?.score_commitment ?? 0) > 0);
        assert.ok((session?.goalTracker?.score_timeline ?? 0) > 0);
      },
    },
  ];

  for (const s of scenarios) {
    await clearPhone(s.phone);
    await runInbound(s.phone, `wamid.${s.id}.${Date.now()}`, s.text);
    const ctx = await fetchState(s.phone);
    s.assertFn(ctx);
    console.log(`[ok] ${s.id}`);
  }

  console.log('Freddy v2 E2E scenarios 9-14 passed.');
  await mongoose.disconnect();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});

