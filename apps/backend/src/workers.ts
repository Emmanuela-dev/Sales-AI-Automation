/**
 * Workers process — runs all BullMQ workers + cron scheduler.
 * Start separately from the API server for production.
 * In development, the API server imports this automatically.
 *
 * Usage:
 *   npx tsx src/workers.ts
 */
import 'dotenv/config';

// Import workers so they register themselves against Redis
import './queues/analysisQueue';
import './queues/aiQueue';
import { startScheduler } from './queues/schedulerQueue';

startScheduler();

console.log('✅ All workers started.');
console.log('   - analysisWorker  (Playwright website analysis, concurrency=3)');
console.log('   - aiWorker        (Lead scoring + company research, concurrency=5)');
console.log('   - scheduler       (Follow-up checks every 6 hours)');

// Keep the process alive
process.on('SIGTERM', () => {
  console.log('Workers shutting down gracefully...');
  process.exit(0);
});
