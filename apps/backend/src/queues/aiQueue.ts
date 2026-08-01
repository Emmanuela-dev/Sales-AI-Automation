import { Queue, Worker } from 'bullmq';
import { redisConnection, logRedisError } from '../lib/redis';
import { scoreLead } from '../services/ai/leadScorer';
import { runCompanyResearch } from '../services/ai/researchAgent';
import { supabaseAdmin } from '../lib/supabase';

export const AI_QUEUE = 'ai-processing';

interface LeadScoringJobData {
  type: 'score_lead';
  lead_id: string;
  business_id: string;
}

interface ResearchJobData {
  type: 'company_research';
  business_id: string;
}

type AiJobData = LeadScoringJobData | ResearchJobData;

// Queue instance
export const aiQueue = new Queue<AiJobData>(AI_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

// Enqueue helpers
export async function enqueueLeadScoring(data: { lead_id: string; business_id: string }) {
  return aiQueue.add('score_lead', { type: 'score_lead', ...data });
}

export async function enqueueResearch(data: { business_id: string }) {
  return aiQueue.add('company_research', { type: 'company_research', ...data });
}

// Worker
export const aiWorker = new Worker<AiJobData>(
  AI_QUEUE,
  async (job) => {
    const data = job.data;

    if (data.type === 'score_lead') {
      job.log(`Scoring lead ${data.lead_id}`);
      const result = await scoreLead({
        lead_id: data.lead_id,
        business_id: data.business_id,
      });
      job.log(`Score: ${result.score}/100`);
      return result;
    }

    if (data.type === 'company_research') {
      job.log(`Researching business ${data.business_id}`);
      const { data: biz, error: bizError } = await supabaseAdmin
        .from('businesses')
        .select('*')
        .eq('id', data.business_id)
        .maybeSingle();

      if (bizError) throw new Error(`Failed to load business: ${bizError.message}`);
      if (!biz) throw new Error(`Business ${data.business_id} not found`);

      const { data: analysis } = await supabaseAdmin
        .from('website_analyses')
        .select('*')
        .eq('business_id', data.business_id)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const result = await runCompanyResearch(biz, analysis);
      job.log(`Research complete for ${biz.name}`);
      return result;
    }

    throw new Error(`Unknown job type: ${(data as { type: string }).type}`);
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

aiWorker.on('completed', (job) => {
  console.log(`[AIWorker] Job ${job.id} (${job.name}) completed`);
});

aiWorker.on('failed', (job, err) => {
  console.error(`[AIWorker] Job ${job?.id} (${job?.name}) failed:`, err.message);
});

// Without these listeners BullMQ rethrows connection errors, which surfaced as
// raw AggregateError dumps on every reconnect attempt.
aiQueue.on('error', (err) => logRedisError('ai-queue', err));
aiWorker.on('error', (err) => logRedisError('ai-worker', err));
