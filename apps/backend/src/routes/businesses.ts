import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { NotFoundError, requireUserId } from '../lib/auth';

const uuidParam = z.object({ id: z.string().uuid() });

const listQuerySchema = z.object({
  industry: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function businessRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/businesses
   * List all saved businesses with optional filters
   */
  fastify.get('/', async (request, reply) => {
    requireUserId(request);
    const query = listQuerySchema.parse(request.query);

    let builder = supabaseAdmin
      .from('businesses')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (query.industry) builder = builder.eq('industry', query.industry);
    if (query.city) builder = builder.ilike('city', `%${query.city}%`);
    if (query.country) builder = builder.eq('country', query.country);

    const { data, error, count } = await builder;
    if (error) throw new Error(`Failed to list businesses: ${error.message}`);

    // `total` is the number of matching rows, not the size of this page.
    return reply.send({ businesses: data ?? [], total: count ?? 0 });
  });

  /**
   * GET /api/v1/businesses/:id
   * Get a single business with all related data
   */
  fastify.get('/:id', async (request, reply) => {
    requireUserId(request);
    const { id } = uuidParam.parse(request.params);

    const [bizResult, analysisResult, researchResult] = await Promise.all([
      supabaseAdmin.from('businesses').select('*').eq('id', id).maybeSingle(),
      supabaseAdmin.from('website_analyses').select('*').eq('business_id', id).order('analyzed_at', { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from('company_research').select('*').eq('business_id', id).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (bizResult.error) throw new Error(`Failed to load business: ${bizResult.error.message}`);
    if (!bizResult.data) throw new NotFoundError('Business not found');

    return reply.send({
      business: bizResult.data,
      website_analysis: analysisResult.data,
      company_research: researchResult.data,
    });
  });

  /**
   * DELETE /api/v1/businesses/:id
   *
   * Businesses are shared between users and leads cascade on delete, so this
   * refuses to run while anyone else still has a lead against the business.
   */
  fastify.delete('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = uuidParam.parse(request.params);

    const { data: leads, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('user_id')
      .eq('business_id', id);

    if (leadError) throw new Error(`Failed to check dependent leads: ${leadError.message}`);

    const otherOwners = (leads ?? []).filter((lead) => lead.user_id !== userId);
    if (otherOwners.length > 0) {
      return reply.code(409).send({
        error: `Cannot delete: ${otherOwners.length} lead(s) belonging to other users reference this business.`,
      });
    }

    const { error } = await supabaseAdmin.from('businesses').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete business: ${error.message}`);
    return reply.code(204).send();
  });
}
