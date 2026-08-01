/**
 * Preflight check — verifies every external dependency the app needs.
 * Usage: npm run doctor (from apps/backend, or `npm run doctor` at the root)
 *
 * Each check reports what to do when it fails, so a broken setup is diagnosable
 * without reading the source.
 */
import 'dotenv/config';
import { env, configStatus } from '../config/env';

type Status = 'pass' | 'warn' | 'fail';

interface CheckResult {
  name: string;
  status: Status;
  detail: string;
  hint?: string;
}

const results: CheckResult[] = [];

function record(result: CheckResult): void {
  const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️ ' : '❌';
  console.log(`${icon} ${result.name}: ${result.detail}`);
  if (result.hint && result.status !== 'pass') console.log(`     → ${result.hint}`);
  results.push(result);
}

async function checkSupabase(): Promise<void> {
  if (!configStatus.supabase) {
    return record({
      name: 'Supabase',
      status: 'fail',
      detail: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are still placeholders',
      hint: 'Fill them in apps/backend/.env from Supabase → Project Settings → API',
    });
  }

  const { supabaseAdmin } = await import('../lib/supabase');

  const { error } = await supabaseAdmin
    .from('businesses')
    .select('id', { count: 'exact', head: true });

  if (!error) {
    return record({ name: 'Supabase', status: 'pass', detail: 'connected, schema present' });
  }

  // PGRST205/42P01 mean we reached the database but the table isn't there yet.
  const missingTable = /does not exist|could not find the table/i.test(error.message);
  record({
    name: 'Supabase',
    status: 'fail',
    detail: missingTable ? 'connected, but the schema is missing' : error.message,
    hint: missingTable
      ? 'Run `npm run migrate` to create the tables'
      : 'Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
  });
}

async function checkRedis(): Promise<void> {
  const IORedis = (await import('ioredis')).default;
  const { redisConnection, describeRedisError } = await import('../lib/redis');

  // A one-shot client: fail fast instead of inheriting the app's retry loop.
  const connection = new IORedis({
    ...redisConnection,
    retryStrategy: () => null,
    lazyConnect: true,
  });

  // connect() rejects with a generic "Connection is closed", so keep the first
  // real error — that's the one that names the actual cause.
  let firstError: unknown = null;
  connection.on('error', (err) => {
    firstError ??= err;
  });

  try {
    await connection.connect();
    const pong = await connection.ping();
    record({ name: 'Redis', status: 'pass', detail: `responded to PING with ${pong}` });
  } catch (err) {
    record({
      name: 'Redis',
      status: 'fail',
      detail: describeRedisError(firstError ?? err),
      hint: 'Start it with `docker-compose up -d redis`',
    });
  } finally {
    connection.disconnect();
  }
}

async function checkPlaywright(): Promise<void> {
  const { chromium } = await import('playwright');

  try {
    const browser = await chromium.launch({ headless: true });
    const version = browser.version();
    await browser.close();
    record({ name: 'Playwright', status: 'pass', detail: `chromium ${version} launches` });
  } catch (err) {
    record({
      name: 'Playwright',
      status: 'fail',
      detail: (err as Error).message.split('\n')[0],
      hint: 'Run `npx playwright install chromium` in the project root',
    });
  }
}

async function checkOpenAI(): Promise<void> {
  if (!configStatus.openai) {
    return record({
      name: 'OpenAI',
      status: 'fail',
      detail: 'OPENAI_API_KEY is missing or still a placeholder',
      hint: 'Add a real key to apps/backend/.env — AI scoring, research, outreach and proposals depend on it',
    });
  }

  const { generateJson } = await import('../lib/openai');

  try {
    // Exercises the exact path the AI services use: JSON mode plus parsing.
    const result = await generateJson<{ ok?: unknown }>({
      prompt: 'Respond ONLY with this JSON object: {"ok": true}',
      temperature: 0,
      purpose: 'Doctor check',
    });

    if (result.ok === true) {
      record({
        name: 'OpenAI',
        status: 'pass',
        detail: `model "${env.OPENAI_MODEL}" responded and returned valid JSON`,
      });
    } else {
      record({
        name: 'OpenAI',
        status: 'warn',
        detail: `model "${env.OPENAI_MODEL}" replied, but not with the requested JSON`,
        hint: 'The key works. Try a more capable model via OPENAI_MODEL.',
      });
    }
  } catch (err) {
    record({ name: 'OpenAI', status: 'fail', detail: (err as Error).message });
  }
}

async function checkGooglePlaces(): Promise<void> {
  if (!configStatus.googlePlaces) {
    return record({
      name: 'Google Places',
      status: 'warn',
      detail: 'not configured — search falls back to the existing database only',
      hint: 'Set GOOGLE_PLACES_API_KEY to discover new businesses',
    });
  }

  const axios = (await import('axios')).default;

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: { query: 'hotels in Nairobi', key: env.GOOGLE_PLACES_API_KEY },
      timeout: 15000,
    });
    const status = response.data?.status;

    if (status === 'OK' || status === 'ZERO_RESULTS') {
      record({
        name: 'Google Places',
        status: 'pass',
        detail: `API responded ${status} (${response.data?.results?.length ?? 0} results)`,
      });
    } else {
      record({
        name: 'Google Places',
        status: 'fail',
        detail: `${status}: ${response.data?.error_message ?? 'no detail'}`,
        hint: 'Check the key, and that Places API is enabled with billing active',
      });
    }
  } catch (err) {
    record({ name: 'Google Places', status: 'fail', detail: (err as Error).message });
  }
}

async function main() {
  console.log(`\nProspectAI preflight check (NODE_ENV=${env.NODE_ENV})\n`);

  // Sequential so the output reads top to bottom.
  await checkSupabase();
  await checkRedis();
  await checkPlaywright();
  await checkOpenAI();
  await checkGooglePlaces();

  const failed = results.filter((r) => r.status === 'fail');
  const warned = results.filter((r) => r.status === 'warn');

  console.log(
    `\n${results.length - failed.length - warned.length} passed, ` +
      `${warned.length} warning(s), ${failed.length} failed.\n`
  );

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Preflight check crashed:', err);
  process.exit(1);
});
