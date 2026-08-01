import { Queue, Worker, Job } from 'bullmq';
import { redisConnection, logRedisError } from '../lib/redis';
import { analyzeWebsite } from '../services/analysis/websiteAnalyzer';
import { supabaseAdmin } from '../lib/supabase';

export const ANALYSIS_QUEUE = 'website-analysis';

interface AnalysisJobData {
  business_id: string;
  url: string;
  priority?: 'high' | 'normal' | 'low';
}

// Queue instance
export const analysisQueue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Enqueue helper
export async function enqueueAnalysis(data: AnalysisJobData): Promise<Job<AnalysisJobData>> {
  const priority = data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5;
  return analysisQueue.add('analyze', data, { priority });
}

// Worker
export const analysisWorker = new Worker<AnalysisJobData>(
  ANALYSIS_QUEUE,
  async (job) => {
    const { business_id, url } = job.data;
    job.log(`Analyzing website: ${url}`);

    const result = await analyzeWebsite(url);

    // Insert (not upsert): each run is a new point-in-time snapshot, and readers
    // take the most recent row by analyzed_at. The previous upsert carried a
    // freshly generated UUID so it could never conflict anyway — and its error
    // was discarded, meaning a failed save was reported as a successful job.
    const { error } = await supabaseAdmin
      .from('website_analyses')
      .insert({ business_id, ...result });

    if (error) {
      throw new Error(`Failed to save website analysis: ${error.message}`);
    }

    job.log(`Analysis complete. Score: ${result.score}/100`);
    return result;
  },
  {
    connection: redisConnection,
    concurrency: 3, // Max 3 Playwright instances at once
  }
);

analysisWorker.on('completed', (job) => {
  console.log(`[AnalysisWorker] Job ${job.id} completed for business ${job.data.business_id}`);
});

analysisWorker.on('failed', (job, err) => {
  console.error(`[AnalysisWorker] Job ${job?.id} failed:`, err.message);
});

// Without these listeners BullMQ rethrows connection errors, which surfaced as
// raw AggregateError dumps on every reconnect attempt.
analysisQueue.on('error', (err) => logRedisError('analysis-queue', err));
analysisWorker.on('error', (err) => logRedisError('analysis-worker', err));
