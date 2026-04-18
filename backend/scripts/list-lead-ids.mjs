#!/usr/bin/env node
/**
 * Print recent leads with MongoDB _id (for vaani:test-call, etc.)
 *
 *   cd backend && node scripts/list-lead-ids.mjs
 *   node scripts/list-lead-ids.mjs --limit=5
 *   node scripts/list-lead-ids.mjs --phone=98xxxx
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

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

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set in backend/.env');
  process.exit(1);
}

const argv = process.argv.slice(2);
let limit = 20;
let phoneQ;
for (const a of argv) {
  if (a.startsWith('--limit=')) limit = Math.min(100, Math.max(1, parseInt(a.slice(8), 10) || 20));
  if (a.startsWith('--phone=')) phoneQ = a.slice(8).replace(/\D/g, '');
}

async function main() {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('leads');
  const q = phoneQ
    ? { phone: { $regex: new RegExp(phoneQ) } }
    : {};
  const cur = col
    .find(q)
    .project({ name: 1, phone: 1, email: 1, stage: 1, source: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(limit);
  const rows = await cur.toArray();
  if (!rows.length) {
    console.log('No leads found.', phoneQ ? `(--phone filter)` : '');
    await mongoose.disconnect();
    return;
  }
  console.log('Lead ID (use for vaani:test-call) | Name | Phone | Stage\n');
  for (const l of rows) {
    const id = String(l._id);
    const n = l.name ?? '';
    const p = l.phone ?? '—';
    const st = l.stage ?? '—';
    console.log(id);
    console.log(`  name: ${n}  phone: ${p}  stage: ${st}`);
    console.log('');
  }
  console.log('Example:');
  console.log(
    `  npm run vaani:test-call -- ${String(rows[0]._id)}`,
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
