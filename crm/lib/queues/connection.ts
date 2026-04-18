import Redis from 'ioredis';

/**
 * BullMQ requires the Redis **TCP** protocol (TLS).
 * Upstash: use the `rediss://default:<token>@<host>:6379` URL from the Upstash dashboard
 * (often labeled "Redis URL"), not the HTTP REST API URL.
 *
 * Set `REDIS_URL` or `UPSTASH_REDIS_URL` to that value. `UPSTASH_REDIS_REST_TOKEN` is reused as password when using host mode below.
 */
function attachRedisLogging(client: Redis, label: string): Redis {
  let lastResetLogAt = 0;
  client.on('error', (err: NodeJS.ErrnoException) => {
    if (err?.code === 'ECONNRESET') {
      const now = Date.now();
      // Avoid flooding logs while still surfacing ongoing reconnect loops.
      if (now - lastResetLogAt > 10_000) {
        lastResetLogAt = now;
        console.warn(`[redis:${label}] socket reset by peer (ECONNRESET); retrying`);
      }
      return;
    }
    console.error(`[redis:${label}]`, err);
  });
  return client;
}

export function createBullConnection(label = 'bullmq'): Redis {
  const rawRedisUrl = process.env.REDIS_URL?.trim();
  if (rawRedisUrl?.startsWith('http://') || rawRedisUrl?.startsWith('https://')) {
    throw new Error(
      'REDIS_URL looks like an HTTP URL. BullMQ needs the Redis TCP URL (starts with rediss:// or redis://). In Upstash open the Redis database → Redis tab → copy "Redis URL", not REST.',
    );
  }

  const url =
    rawRedisUrl ||
    process.env.UPSTASH_REDIS_URL?.trim() ||
    '';

  if (url.startsWith('redis://') && /upstash\.io/i.test(url)) {
    throw new Error(
      'Upstash Redis requires TLS. Use REDIS_URL with rediss:// (not redis://). ' +
        'Copy the value from Upstash Redis tab → "Redis URL".',
    );
  }

  if (url.startsWith('rediss://') || url.startsWith('redis://')) {
    return attachRedisLogging(
      new Redis(url, {
        family: 4,
        connectTimeout: 10_000,
        keepAlive: 30_000,
        retryStrategy: (times: number) => Math.min(times * 500, 5_000),
        reconnectOnError: () => true,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      }),
      label,
    );
  }

  const host = process.env.UPSTASH_REDIS_HOST?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_PASSWORD?.trim();

  if (host && token) {
    return attachRedisLogging(
      new Redis({
        host,
        port: Number(process.env.UPSTASH_REDIS_PORT ?? 6379),
        username: process.env.UPSTASH_REDIS_USERNAME || 'default',
        password: token,
        tls: {},
        family: 4,
        connectTimeout: 10_000,
        keepAlive: 30_000,
        retryStrategy: (times: number) => Math.min(times * 500, 5_000),
        reconnectOnError: () => true,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      }),
      label,
    );
  }

  throw new Error(
    'Missing valid Redis TCP URL. Add to crm/.env.local:\n' +
      '  REDIS_URL=rediss://default:TOKEN@HOST:6379\n' +
      '(from Upstash → your Redis DB → Redis tab → "Redis URL".)\n' +
      'Or set UPSTASH_REDIS_HOST + UPSTASH_REDIS_REST_TOKEN (password).\n' +
      'Env is loaded from crm/.env.local even if you run npm from the repo root.',
  );
}
