import cron from 'node-cron';
import { runFollowUpCheck } from '../services/ai/followUpAgent';

/** Every 6 hours, on the hour. */
const FOLLOW_UP_SCHEDULE = '0 */6 * * *';

let task: cron.ScheduledTask | null = null;
let running = false;

/**
 * Scheduler — runs periodic background jobs
 */
export function startScheduler(): void {
  if (task) return; // Never register the same cron twice.

  task = cron.schedule(FOLLOW_UP_SCHEDULE, async () => {
    // A slow sweep must not overlap with the next tick and double-post
    // follow-ups.
    if (running) {
      console.warn('[Scheduler] Previous follow-up check still running — skipping this tick.');
      return;
    }

    running = true;
    console.log('[Scheduler] Running follow-up check...');
    try {
      const result = await runFollowUpCheck();
      console.log(
        `[Scheduler] Follow-up check complete. ${result.scanned} stale lead(s) scanned, ` +
          `${result.created} created, ${result.skipped} already pending, ${result.failed} failed.`
      );
    } catch (err) {
      console.error('[Scheduler] Follow-up check failed:', (err as Error).message);
    } finally {
      running = false;
    }
  });

  console.log('[Scheduler] Started. Follow-up checks run every 6 hours.');
}

export function stopScheduler(): void {
  task?.stop();
  task = null;
}
