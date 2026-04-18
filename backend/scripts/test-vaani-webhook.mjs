#!/usr/bin/env node
/**
 * Local smoke test for POST /api/v1/webhooks/vaani
 *
 * Uses the same HMAC-SHA256(hex) as the Vaani portal (body bytes + VAANI_WEBHOOK_SECRET).
 *
 * Usage:
 *   cd backend && node scripts/test-vaani-webhook.mjs
 *   WEBHOOK_TEST_URL=https://xxx.ngrok-free.app/api/v1/webhooks/vaani node scripts/test-vaani-webhook.mjs
 *
 * Loads backend/.env if present (simple KEY=value lines).
 */
import { createHmac } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const p = join(__dirname, '..', '.env');
  if (!existsSync(p)) return;
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

loadDotEnv();

const secret = (process.env.VAANI_WEBHOOK_SECRET ?? '').trim();
const baseUrl =
  process.env.WEBHOOK_TEST_URL?.trim() ||
  'http://127.0.0.1:3001/api/v1/webhooks/vaani';

/** Minimal payload — no matching lead; handler still returns 200 { status: 'ok' } */
const bodyObj = {
  event: 'call_ringing',
  room_name: 'smoke-test-room',
};
const body = JSON.stringify(bodyObj);
const raw = Buffer.from(body, 'utf8');

const headers = {
  'Content-Type': 'application/json',
};

if (secret) {
  const sig = createHmac('sha256', secret).update(raw).digest('hex');
  headers['Vaani-Signature'] = sig;
} else {
  console.warn(
    '[test-vaani-webhook] VAANI_WEBHOOK_SECRET is empty — server will skip auth. Set it to match production behavior.',
  );
}

async function main() {
  console.log('POST', baseUrl);
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body,
  });
  const text = await res.text();
  console.log('HTTP', res.status, text);
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
