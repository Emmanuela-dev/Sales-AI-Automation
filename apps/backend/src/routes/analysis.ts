import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { enqueueAnalysis } from '../queues/analysisQueue';
import { analyzeWebsite } from '../services/analysis/websiteAnalyzer';
import { NotFoundError, requireUserId } from '../lib/auth';

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
    requireUserId(request);
    const { id } = uuidParam.parse(request.params);

    const { data, error } = await supabaseAdmin
      .from('website_analyses')
      .select('*')
      .eq('business_id', id)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to load analysis: ${error.message}`);
    if (!data) throw new NotFoundError('No analysis found for this business');
    return reply.send({ analysis: data });
  });

  /**
   * POST /api/v1/analysis/trigger
   * Manually trigger a website analysis (queued)
   */
  fastify.post('/trigger', async (request, reply) => {
    requireUserId(request);
    const body = triggerAnalysisSchema.parse(request.body);

    const { data: business, error } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('id', body.business_id)
      .maybeSingle();

    if (error) throw new Error(`Failed to verify business: ${error.message}`);
    if (!business) throw new NotFoundError('Business not found');

    try {
      const job = await enqueueAnalysis(body);
      return reply.code(202).send({ message: 'Analysis queued', job_id: job.id });
    } catch (err) {
      request.log.error({ err }, 'Could not queue analysis');
      return reply.code(503).send({
        error: 'Analysis could not be queued. Is Redis running? Try `docker-compose up -d redis`.',
      });
    }
  });

  /**
   * POST /api/v1/analysis/run
   * Run an analysis synchronously (for quick previews).
   * Slower than /trigger — it launches a browser inline and waits.
   */
  fastify.post('/run', async (request, reply) => {
    requireUserId(request);
    const body = z.object({ url: z.string().url() }).parse(request.body);
    const result = await analyzeWebsite(body.url);
    return reply.send({ analysis: result });
  });
}
