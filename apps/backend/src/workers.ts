/**
 * Workers process — runs all BullMQ workers + cron scheduler.
 * Start separately from the API server for production.
 * In development, the API server imports this automatically.
 *
 * Usage:
 *   npm run dev:workers     (development)
 *   npm run start:workers   (production, after npm run build)
 */
import 'dotenv/config';
import { warnAboutPlaceholders } from './config/env';
import { analysisWorker } from './queues/analysisQueue';
import { aiWorker } from './queues/aiQueue';
import { startScheduler, stopScheduler } from './queues/schedulerQueue';

async function main() {
  warnAboutPlaceholders();

  // Surface a Redis outage as a readable startup failure rather than letting the
  // process sit there looking healthy while consuming nothing. The workers retry
  // forever by design, so bound the wait.
  await withTimeout(
    Promise.all([analysisWorker.waitUntilReady(), aiWorker.waitUntilReady()]),
    15_000,
    'Timed out waiting for Redis after 15s'
  );

  startScheduler();

  console.log('✅ All workers started.');
  console.log('   - analysisWorker  (Playwright website analysis, concurrency=3)');
  console.log('   - aiWorker        (Lead scoring + company research, concurrency=5)');
  console.log('   - scheduler       (Follow-up checks every 6 hours)');
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} received — finishing in-flight jobs before exit...`);
  stopScheduler();

  try {
    // close() lets active jobs finish instead of orphaning them in the queue.
    await Promise.all([analysisWorker.close(), aiWorker.close()]);
    console.log('Workers shut down cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', (err as Error).message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

main().catch((err) => {
  console.error('❌ Workers failed to start:', (err as Error).message);
  console.error('   Is Redis running? Try `docker-compose up -d redis`.');
  process.exit(1);
});
