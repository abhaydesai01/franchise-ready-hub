#!/usr/bin/env node
/**
 * Place ONE real outbound call via Vaani for a lead in MongoDB, and store vaaniCallId on the lead
 * so POST /webhooks/vaani can match events (room_name ↔ vaaniCallId).
 *
 * Prereqs:
 *   - backend/.env: MONGODB_URI, VAANI_API_KEY, VAANI_AGENT_ID
 *   - Optional: VAANI_OUTBOUND_NUMBER (omit from API body if unset — portal default caller ID)
 *   - Optional: VAANI_BASE_URL (default https://api.vaanivoice.ai)
 *   - Lead must have a reachable phone (10+ digits); use YOUR test mobile.
 *
 * Usage:
 *   cd backend
 *   node scripts/trigger-vaani-test-call.mjs <mongoLeadId>
 *   node scripts/trigger-vaani-test-call.mjs <mongoLeadId> --phone=+9198xxxxxxx
 *
 * Example:
 *   node scripts/trigger-vaani-test-call.mjs 674a1b2c3d4e5f6789012345
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const p = join(__dirname, '..', '.env');
  if (!existsSync(p)) {
    console.error('Missing backend/.env');
    process.exit(1);
  }
  const txt = readFileSync(p, 'utf8');
  for (const line of txt.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function toE164(phone) {
  const d = String(phone ?? '').replace(/\D/g, '');
  if (d.length >= 10 && d.startsWith('91')) return `+${d}`;
  if (d.length === 10) return `+91${d}`;
  const t = String(phone ?? '').trim();
  if (t.startsWith('+')) return t;
  return `+${d}`;
}

function readinessBandLabel(lead) {
  const b = lead.readinessBand;
  if (!b) return 'pending';
  const map = {
    franchise_ready: 'Franchise Ready',
    recruitment_only: 'Recruitment Only',
    not_ready: 'Not Ready',
  };
  return map[b] ?? String(b);
}

function parseArgs(argv) {
  const leadId = argv.find((a) => !a.startsWith('--'));
  let phoneOverride;
  for (const a of argv) {
    if (a.startsWith('--phone=')) phoneOverride = a.slice('--phone='.length);
  }
  return { leadId, phoneOverride };
}

loadDotEnv();

const { leadId, phoneOverride } = parseArgs(process.argv.slice(2));
if (!leadId || !/^[a-f\d]{24}$/i.test(leadId)) {
  console.error(
    'Usage: node scripts/trigger-vaani-test-call.mjs <mongoLeadId> [--phone=+91...]',
  );
  process.exit(1);
}

const apiKey = (process.env.VAANI_API_KEY ?? '').trim();
const agentId = (process.env.VAANI_AGENT_ID ?? '').trim();
const outbound = (process.env.VAANI_OUTBOUND_NUMBER ?? '').trim();
const baseUrl = (
  process.env.VAANI_BASE_URL ?? 'https://api.vaanivoice.ai'
).replace(/\/$/, '');

if (!apiKey || !agentId) {
  console.error(
    'Set VAANI_API_KEY and VAANI_AGENT_ID in backend/.env (VAANI_OUTBOUND_NUMBER optional)',
  );
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI missing');
  process.exit(1);
}

const PLACEHOLDER_SLOTS =
  'Option 1: morning slot, Option 2: afternoon slot, Option 3: evening slot (CRM test — confirm real slots in production)';

async function main() {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('leads');
  const lead = await col.findOne({
    _id: new mongoose.Types.ObjectId(leadId),
  });
  if (!lead) {
    console.error('Lead not found:', leadId);
    process.exit(1);
  }

  const phone = phoneOverride?.trim() || toE164(lead.phone);
  if (phone.replace(/\D/g, '').length < 10) {
    console.error('Lead has no valid phone. Pass --phone=+91xxxxxxxxxx');
    process.exit(1);
  }

  let companyName =
    process.env.COMPANY_NAME?.trim() || 'Franchise Ready';
  try {
    const settingsCol = mongoose.connection.collection('app_settings');
    const s = await settingsCol.findOne({});
    const cn = s?.branding?.companyName?.trim();
    if (cn) companyName = cn;
  } catch {
    // ignore
  }

  const leadName = String(lead.name ?? 'Lead');
  const score = Number(lead.totalScore ?? lead.score ?? 0);
  const band = readinessBandLabel(lead);

  const body = {
    agent_id: agentId,
    contact_number: phone,
    name: leadName,
    voice: '',
    metadata: {
      lead_id: leadId,
      lead_name: leadName,
      company_name: companyName,
      trigger_reason: 'intro_no_response',
      readiness_score: String(score),
      readiness_band: band,
      available_slots: PLACEHOLDER_SLOTS,
    },
  };
  if (outbound) {
    body.outbound_number = outbound;
  }

  console.log('Triggering Vaani call…');
  console.log('  Lead:', leadId, leadName);
  console.log('  To:', phone);
  if (outbound) console.log('  Outbound (CLI):', outbound);
  else console.log('  Outbound: (omitted — Vaani portal default)');

  const res = await fetch(`${baseUrl}/api/trigger-call/`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    console.error('Vaani error:', res.status, JSON.stringify(data));
    process.exit(1);
  }

  let callId;
  let dispatchId;
  const out = data.output;
  if (out && typeof out === 'object' && out.call_id) {
    callId = out.call_id;
    dispatchId = out.dispatch_id;
  } else if (typeof out === 'string') {
    const m = out.match(/\bto room ([A-Za-z0-9_\-]+)/i) || out.match(/\broom ([A-Za-z0-9_\-]+)/i);
    const d = out.match(/dispatch_id:\s*([A-Za-z0-9_]+)/i);
    if (m) {
      callId = m[1];
      if (d) dispatchId = d[1];
    }
  }
  if (!callId) {
    console.error('No room / call_id in response:', JSON.stringify(data));
    process.exit(1);
  }

  const entry = {
    vaaniCallId: callId,
    triggeredAt: new Date(),
    triggerReason: 'intro_no_response',
    status: 'initiated',
  };
  if (dispatchId) entry.vaaniDispatchId = dispatchId;

  await col.updateOne(
    { _id: new mongoose.Types.ObjectId(leadId) },
    { $push: { voiceCalls: entry } },
  );

  console.log('');
  console.log('OK — Vaani accepted the call.');
  console.log('  room (vaaniCallId):', callId);
  if (dispatchId) console.log('  dispatch_id:', dispatchId);
  console.log('  Stored on lead voiceCalls[] (matches transcript / call_details / webhooks).');
  console.log('');
  console.log('Next: answer the phone. Watch Nest logs for Vaani webhook events.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
