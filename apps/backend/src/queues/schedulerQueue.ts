import cron from 'node-cron';
import { runFollowUpCheck } from '../services/ai/followUpAgent';

/**
 * Scheduler — runs periodic background jobs
 */
export function startScheduler(): void {
  // Check for stale leads and create follow-up suggestions every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Scheduler] Running follow-up check...');
    try {
      await runFollowUpCheck();
      console.log('[Scheduler] Follow-up check complete.');
    } catch (err) {
      console.error('[Scheduler] Follow-up check failed:', err);
    }
  });

  console.log('[Scheduler] Started. Follow-up checks run every 6 hours.');
}
