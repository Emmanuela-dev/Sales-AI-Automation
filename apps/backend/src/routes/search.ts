import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { searchBusinesses } from '../services/discovery/searchService';
import { enqueueAnalysis } from '../queues/analysisQueue';

const searchSchema = z.object({
  query: z.string().min(2),
  city: z.string().optional(),
  country: z.string().optional(),
  industry: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export async function searchRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/search
   * Natural-language business search (e.g. "Hotels in Nairobi")
   */
  fastify.post('/', async (request, reply) => {
    const body = searchSchema.parse(request.body);

    const result = await searchBusinesses(body);

    // Automatically enqueue website analysis for discovered businesses
    for (const biz of result.businesses) {
      if (biz.website) {
        await enqueueAnalysis({ business_id: biz.id, url: biz.website });
      }
    }

    return reply.code(200).send(result);
  });

  /**
   * GET /api/v1/search/industries
   * Return a list of supported industry categories
   */
  fastify.get('/industries', async (_request, reply) => {
    return reply.send([
      'Hospitality', 'Restaurant & Food', 'Healthcare', 'Legal', 'Education',
      'Real Estate', 'Finance & Banking', 'Retail', 'Technology', 'Construction',
      'Transport & Logistics', 'Beauty & Wellness', 'Automotive', 'Agriculture',
      'NGO & Non-Profit', 'Government', 'Media & Entertainment', 'Manufacturing',
    ]);
  });
}
