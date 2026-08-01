import { type RedisOptions } from 'ioredis';
import { env } from '../config/env';

/**
 * Connection options rather than a shared client.
 *
 * BullMQ needs several connections per queue (a command client, a blocking
 * client, and a subscriber). Handed a single instance it silently duplicates it,
 * and those duplicates carry no error listener — so with Redis down every
 * reconnect attempt dumped a full AggregateError stack to stderr, thousands of
 * lines a minute. Passing options lets BullMQ own its connections, and the
 * Queue/Worker `error` events give us one place to log them.
 */
export const redisConnection: RedisOptions = parseRedisUrl(env.REDIS_URL);

function parseRedisUrl(url: string): RedisOptions {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`REDIS_URL is not a valid URL: "${url}"`);
  }

  const options: RedisOptions = {
    host: parsed.hostname || 'localhost',
    port: Number(parsed.port) || 6379,
    // Required by BullMQ — it does its own retry accounting.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // Back off to a 10s ceiling instead of hammering a down server.
    retryStrategy: (attempt) => Math.min(attempt * 500, 10_000),
  };

  if (parsed.username) options.username = decodeURIComponent(parsed.username);
  if (parsed.password) options.password = decodeURIComponent(parsed.password);

  const db = parsed.pathname.replace(/^\//, '');
  if (db) options.db = Number(db);

  if (parsed.protocol === 'rediss:') options.tls = {};

  return options;
}

/**
 * Connection failures arrive as an AggregateError whose own `message` is empty,
 * which is why the logs previously showed a bare "Redis error:" with nothing
 * after it. Pull something readable out of it.
 */
export function describeRedisError(err: unknown): string {
  if (err instanceof AggregateError) {
    const inner = err.errors?.[0] as (Error & { code?: string }) | undefined;
    const code = (err as Error & { code?: string }).code ?? inner?.code ?? 'unknown error';
    return `${code} connecting to ${redisConnection.host}:${redisConnection.port}`;
  }
  if (err instanceof Error) return err.message || err.name;
  return String(err);
}

const LOG_THROTTLE_MS = 30_000;
const lastLoggedAt = new Map<string, number>();

/** Logs at most once per label per 30s so an outage can't drown the log. */
export function logRedisError(label: string, err: unknown): void {
  const now = Date.now();
  const previous = lastLoggedAt.get(label) ?? 0;
  if (now - previous < LOG_THROTTLE_MS) return;

  lastLoggedAt.set(label, now);
  console.error(
    `❌ Redis unavailable (${label}): ${describeRedisError(err)} — ` +
      'background jobs are paused. Start it with `docker-compose up -d redis`.'
  );
}

// Note: no shared client is exported. Everything that needs Redis goes through
// BullMQ, which builds its own connections from `redisConnection`. An always-on
// module-level client would open a connection (and log an outage) just by being
// imported — including from scripts that never touch a queue.
