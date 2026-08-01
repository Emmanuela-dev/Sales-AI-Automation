import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { searchBusinesses } from '../services/discovery/searchService';
import { enqueueAnalysis } from '../queues/analysisQueue';
import { requireUserId } from '../lib/auth';

const searchSchema = z.object({
  query: z.string().min(2).max(200),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export async function searchRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/search
   * Natural-language business search (e.g. "Hotels in Nairobi")
   */
  fastify.post('/', async (request, reply) => {
    requireUserId(request);
    const body = searchSchema.parse(request.body);

    const result = await searchBusinesses(body);

    // Automatically enqueue website analysis for discovered businesses. Queueing
    // is best-effort: a Redis outage must not fail the search itself.
    const withWebsites = result.businesses.filter((biz) => biz.website);
    let analysesQueued = 0;

    for (const biz of withWebsites) {
      try {
        await enqueueAnalysis({ business_id: biz.id, url: biz.website as string });
        analysesQueued++;
      } catch (err) {
        request.log.error({ err, business_id: biz.id }, 'Could not queue website analysis');
        break; // Redis is down — stop retrying for every remaining result.
      }
    }

    return reply.code(200).send({ ...result, analyses_queued: analysesQueued });
  });

  /**
   * GET /api/v1/search/industries
   * Return a list of supported industry categories
   */
  fastify.get('/industries', async (request, reply) => {
    requireUserId(request);
    return reply.send([
      'Hospitality', 'Restaurant & Food', 'Healthcare', 'Legal', 'Education',
      'Real Estate', 'Finance & Banking', 'Retail', 'Technology', 'Construction',
      'Transport & Logistics', 'Beauty & Wellness', 'Automotive', 'Agriculture',
      'NGO & Non-Profit', 'Government', 'Media & Entertainment', 'Manufacturing',
    ]);
  });
}
