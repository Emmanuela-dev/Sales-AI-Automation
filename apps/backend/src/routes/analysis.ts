import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { enqueueAnalysis } from '../queues/analysisQueue';
import { analyzeWebsite } from '../services/analysis/websiteAnalyzer';

const uuidParam = z.object({ id: z.string().uuid() });

const triggerAnalysisSchema = z.object({
  business_id: z.string().uuid(),
  url: z.string().url(),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
});

export async function analysisRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/analysis/:business_id
   * Get the latest website analysis for a business
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);
    const { data, error } = await supabaseAdmin
      .from('website_analyses')
      .select('*')
      .eq('business_id', id)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: 'No analysis found' });
    return reply.send({ analysis: data });
  });

  /**
   * POST /api/v1/analysis/trigger
   * Manually trigger a website analysis (queued)
   */
  fastify.post('/trigger', async (request, reply) => {
    const body = triggerAnalysisSchema.parse(request.body);
    const job = await enqueueAnalysis(body);
    return reply.code(202).send({ message: 'Analysis queued', job_id: job.id });
  });

  /**
   * POST /api/v1/analysis/run
   * Run an analysis synchronously (for quick previews)
   */
  fastify.post('/run', async (request, reply) => {
    const body = z.object({ url: z.string().url() }).parse(request.body);
    const result = await analyzeWebsite(body.url);
    return reply.send({ analysis: result });
  });
}
