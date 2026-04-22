function normalizePercent(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.floor(parsed)));
}

function stableBucket(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) % 10000;
  }
  return hash % 100;
}

export function getFreddyV2FlagConfig(): {
  enabled: boolean;
  rolloutPercent: number;
} {
  const enabledRaw = (process.env.FREDDY_V2_ENABLED ?? 'true').toLowerCase();
  const enabled = enabledRaw === 'true' || enabledRaw === '1' || enabledRaw === 'yes';
  const rolloutPercent = normalizePercent(process.env.FREDDY_V2_ROLLOUT_PERCENT, 100);
  return { enabled, rolloutPercent };
}

export function isFreddyV2EnabledForPhone(phone: string): boolean {
  const { enabled, rolloutPercent } = getFreddyV2FlagConfig();
  if (!enabled) return false;
  if (rolloutPercent >= 100) return true;
  if (rolloutPercent <= 0) return false;
  return stableBucket(phone) < rolloutPercent;
}

