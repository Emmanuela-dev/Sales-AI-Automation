import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { enqueueLeadScoring } from '../queues/aiQueue';

const uuidParam = z.object({ id: z.string().uuid() });

const createLeadSchema = z.object({
  business_id: z.string().uuid(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateLeadSchema = z.object({
  status: z.enum(['discovered', 'analyzing', 'qualified', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost']).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  assigned_to: z.string().optional(),
});

export async function leadRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/leads
   * List all leads with business data joined
   */
  fastify.get('/', async (request, reply) => {
    const query = request.query as Record<string, string>;
    let builder = supabaseAdmin
      .from('leads')
      .select(`
        *,
        businesses (
          id, name, industry, city, country, website, phone, email,
          google_rating, google_reviews_count
        )
      `)
      .order('opportunity_score', { ascending: false });

    if (query.status) builder = builder.eq('status', query.status);
    if (query.min_score) builder = builder.gte('opportunity_score', Number(query.min_score));

    const { data, error } = await builder;
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ leads: data });
  });

  /**
   * POST /api/v1/leads
   * Save a business as a lead and trigger AI scoring
   */
  fastify.post('/', async (request, reply) => {
    const body = createLeadSchema.parse(request.body);

    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert({ ...body, status: 'discovered', user_id: 'system' })
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });

    // Kick off AI lead scoring in background
    await enqueueLeadScoring({ lead_id: data.id, business_id: body.business_id });

    return reply.code(201).send({ lead: data });
  });

  /**
   * GET /api/v1/leads/:id
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select(`*, businesses(*)`)
      .eq('id', id)
      .single();

    if (error) return reply.code(404).send({ error: 'Lead not found' });
    return reply.send({ lead: data });
  });

  /**
   * PATCH /api/v1/leads/:id
   * Update lead status, notes, assignment
   */
  fastify.patch('/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);
    const updates = updateLeadSchema.parse(request.body);

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });

    // Log CRM activity for stage changes
    if (updates.status) {
      await supabaseAdmin.from('crm_activities').insert({
        lead_id: id,
        user_id: 'system',
        type: 'stage_change',
        title: `Stage changed to ${updates.status}`,
      });
    }

    return reply.send({ lead: data });
  });
}
