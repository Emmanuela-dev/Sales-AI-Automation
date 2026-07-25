import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';

const uuidParam = z.object({ id: z.string().uuid() });

export async function businessRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/businesses
   * List all saved businesses with optional filters
   */
  fastify.get('/', async (request, reply) => {
    const query = request.query as Record<string, string>;
    let builder = supabaseAdmin
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });

    if (query.industry) builder = builder.eq('industry', query.industry);
    if (query.city) builder = builder.ilike('city', `%${query.city}%`);
    if (query.country) builder = builder.eq('country', query.country);
    if (query.limit) builder = builder.limit(Number(query.limit));

    const { data, error } = await builder;
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ businesses: data, total: data?.length ?? 0 });
  });

  /**
   * GET /api/v1/businesses/:id
   * Get a single business with all related data
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);

    const [bizResult, analysisResult, researchResult] = await Promise.all([
      supabaseAdmin.from('businesses').select('*').eq('id', id).single(),
      supabaseAdmin.from('website_analyses').select('*').eq('business_id', id).order('analyzed_at', { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from('company_research').select('*').eq('business_id', id).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (bizResult.error) return reply.code(404).send({ error: 'Business not found' });

    return reply.send({
      business: bizResult.data,
      website_analysis: analysisResult.data,
      company_research: researchResult.data,
    });
  });

  /**
   * DELETE /api/v1/businesses/:id
   */
  fastify.delete('/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);
    const { error } = await supabaseAdmin.from('businesses').delete().eq('id', id);
    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(204).send();
  });
}
