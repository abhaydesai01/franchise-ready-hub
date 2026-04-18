/**
 * `tsx` does not load `.env.local` like Next.js.
 * Resolves paths from this file so it works when `npm run worker:sequence`
 * is started from repo root or from `crm/` (cwd-independent).
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// This file lives at crm/lib/queues/load-worker-env.ts → crm root is two levels up
const crmRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const paths = [
  join(crmRoot, '.env'),
  join(crmRoot, '.env.local'),
  // Fallback if someone only has env at process cwd
  join(process.cwd(), '.env'),
  join(process.cwd(), '.env.local'),
];

const seen = new Set<string>();
for (const p of paths) {
  if (seen.has(p) || !existsSync(p)) continue;
  seen.add(p);
  const isLocal = p.endsWith('.env.local');
  config({ path: p, override: isLocal });
}
