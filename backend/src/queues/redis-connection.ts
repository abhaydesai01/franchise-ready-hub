import Redis from 'ioredis';

function attachRedisLogging(client: Redis, label: string): Redis {
  client.on('error', (err: NodeJS.ErrnoException) => {
    console.error(`[redis:${label}]`, err);
  });
  return client;
}

/** Same rules as CRM `crm/lib/queues/connection.ts` — BullMQ needs TCP `rediss://`. */
export function createBullConnection(label = 'bullmq'): Redis {
  const rawRedisUrl = process.env.REDIS_URL?.trim();
  if (rawRedisUrl?.startsWith('http://') || rawRedisUrl?.startsWith('https://')) {
    throw new Error(
      'REDIS_URL must be a Redis TCP URL (rediss:// or redis://), not HTTP.',
    );
  }

  const url =
    rawRedisUrl ||
    process.env.UPSTASH_REDIS_URL?.trim() ||
    '';

  if (url.startsWith('redis://') && /upstash\.io/i.test(url)) {
    throw new Error(
      'Upstash requires TLS: use rediss:// in REDIS_URL (from Upstash Redis tab).',
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
    'REDIS_URL (or UPSTASH host+token) is required for BullMQ queue operations.',
  );
}

let _singleton: Redis | null = null;

export function getSingletonBullConnection(): Redis {
  if (!_singleton) {
    _singleton = createBullConnection('nest-bull-shared');
  }
  return _singleton;
}
