import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { enqueueLeadScoring } from '../queues/aiQueue';
import { NotFoundError, requireUserId } from '../lib/auth';

const uuidParam = z.object({ id: z.string().uuid() });

const listQuerySchema = z.object({
  status: z
    .enum(['discovered', 'analyzing', 'qualified', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost'])
    .optional(),
  min_score: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().min(1).max(200).default(100),
});

const createLeadSchema = z.object({
  business_id: z.string().uuid(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateLeadSchema = z
  .object({
    status: z.enum(['discovered', 'analyzing', 'qualified', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost']).optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    assigned_to: z.string().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' });

export async function leadRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/leads
   * List the caller's leads with business data joined
   */
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request);
    const query = listQuerySchema.parse(request.query);

    let builder = supabaseAdmin
      .from('leads')
      .select(`
        *,
        businesses (
          id, name, industry, city, country, website, phone, email,
          google_rating, google_reviews_count
        )
      `)
      .eq('user_id', userId)
      .order('opportunity_score', { ascending: false, nullsFirst: false })
      .limit(query.limit);

    if (query.status) builder = builder.eq('status', query.status);
    if (query.min_score !== undefined) builder = builder.gte('opportunity_score', query.min_score);

    const { data, error } = await builder;
    if (error) throw new Error(`Failed to list leads: ${error.message}`);
    return reply.send({ leads: data ?? [] });
  });

  /**
   * POST /api/v1/leads
   * Save a business as a lead and trigger AI scoring
   */
  fastify.post('/', async (request, reply) => {
    const userId = requireUserId(request);
    const body = createLeadSchema.parse(request.body);

    // Fail with a clear 404 rather than a raw foreign-key error.
    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('id', body.business_id)
      .maybeSingle();

    if (businessError) throw new Error(`Failed to verify business: ${businessError.message}`);
    if (!business) throw new NotFoundError('Business not found');

    // One lead per business per user.
    const { data: existing } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .eq('business_id', body.business_id)
      .maybeSingle();

    if (existing) {
      return reply.code(200).send({ lead: existing, already_existed: true });
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert({ ...body, status: 'discovered', user_id: userId })
      .select()
      .single();

    if (error) throw new Error(`Failed to create lead: ${error.message}`);

    // Kick off AI lead scoring in background. A queueing failure must not lose
    // the lead the user just saved, so report it without failing the request.
    try {
      await enqueueLeadScoring({ lead_id: data.id, business_id: body.business_id });
    } catch (err) {
      request.log.error({ err }, 'Lead saved but AI scoring could not be queued (is Redis running?)');
      return reply.code(201).send({ lead: data, scoring_queued: false });
    }

    return reply.code(201).send({ lead: data, scoring_queued: true });
  });

  /**
   * GET /api/v1/leads/:id
   */
  fastify.get('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = uuidParam.parse(request.params);

    const { data, error } = await supabaseAdmin
      .from('leads')
      .select(`*, businesses(*)`)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load lead: ${error.message}`);
    if (!data) throw new NotFoundError('Lead not found');
    return reply.send({ lead: data });
  });

  /**
   * PATCH /api/v1/leads/:id
   * Update lead status, notes, assignment
   */
  fastify.patch('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = uuidParam.parse(request.params);
    const updates = updateLeadSchema.parse(request.body);

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Failed to update lead: ${error.message}`);
    if (!data) throw new NotFoundError('Lead not found');

    // Log CRM activity for stage changes
    if (updates.status) {
      const { error: activityError } = await supabaseAdmin.from('crm_activities').insert({
        lead_id: id,
        user_id: userId,
        type: 'stage_change',
        title: `Stage changed to ${updates.status}`,
      });
      if (activityError) {
        request.log.error({ err: activityError }, 'Lead updated but activity log failed');
      }
    }

    return reply.send({ lead: data });
  });
}
