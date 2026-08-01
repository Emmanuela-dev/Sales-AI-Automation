import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { assertLeadOwned, NotFoundError, requireUserId } from '../lib/auth';

const uuidParam = z.object({ id: z.string().uuid() });

const activitySchema = z.object({
  lead_id: z.string().uuid(),
  type: z.enum(['note', 'call', 'email', 'meeting', 'stage_change', 'follow_up']),
  title: z.string().min(1),
  description: z.string().optional(),
  scheduled_at: z.string().datetime().optional(),
});

const followUpSchema = z.object({
  lead_id: z.string().uuid(),
  trigger_type: z.enum(['no_response', 'scheduled', 'meeting_reminder', 'proposal_expiring']),
  message_suggestion: z.string().min(1),
  due_at: z.string().datetime(),
});

export async function crmRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/crm/activities/:lead_id
   */
  fastify.get('/activities/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = uuidParam.parse(request.params);
    await assertLeadOwned(id, userId);

    const { data, error } = await supabaseAdmin
      .from('crm_activities')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to load activities: ${error.message}`);
    return reply.send({ activities: data ?? [] });
  });

  /**
   * POST /api/v1/crm/activities
   */
  fastify.post('/activities', async (request, reply) => {
    const userId = requireUserId(request);
    const body = activitySchema.parse(request.body);
    await assertLeadOwned(body.lead_id, userId);

    const { data, error } = await supabaseAdmin
      .from('crm_activities')
      .insert({ ...body, user_id: userId })
      .select()
      .single();

    if (error) throw new Error(`Failed to create activity: ${error.message}`);
    return reply.code(201).send({ activity: data });
  });

  /**
   * GET /api/v1/crm/follow-ups
   * Pending follow-ups due today or overdue
   */
  fastify.get('/follow-ups', async (request, reply) => {
    const userId = requireUserId(request);

    const { data, error } = await supabaseAdmin
      .from('follow_ups')
      .select(`*, leads!inner(*, businesses(name, industry))`)
      .eq('leads.user_id', userId)
      .eq('status', 'pending')
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true });

    if (error) throw new Error(`Failed to load follow-ups: ${error.message}`);
    return reply.send({ follow_ups: data ?? [] });
  });

  /**
   * POST /api/v1/crm/follow-ups
   */
  fastify.post('/follow-ups', async (request, reply) => {
    const userId = requireUserId(request);
    const body = followUpSchema.parse(request.body);
    await assertLeadOwned(body.lead_id, userId);

    const { data, error } = await supabaseAdmin
      .from('follow_ups')
      .insert({ ...body, user_id: userId, status: 'pending' })
      .select()
      .single();

    if (error) throw new Error(`Failed to create follow-up: ${error.message}`);
    return reply.code(201).send({ follow_up: data });
  });

  /**
   * PATCH /api/v1/crm/follow-ups/:id
   * Mark follow-up as sent or dismissed
   */
  fastify.patch('/follow-ups/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = uuidParam.parse(request.params);
    const { status } = z.object({ status: z.enum(['sent', 'dismissed']) }).parse(request.body);

    // Resolve the parent lead first so another user's follow-up can't be touched.
    const { data: followUp, error: lookupError } = await supabaseAdmin
      .from('follow_ups')
      .select('id, lead_id')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) throw new Error(`Failed to load follow-up: ${lookupError.message}`);
    if (!followUp) throw new NotFoundError('Follow-up not found');
    await assertLeadOwned(followUp.lead_id, userId);

    const { data, error } = await supabaseAdmin
      .from('follow_ups')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update follow-up: ${error.message}`);
    return reply.send({ follow_up: data });
  });

  /**
   * GET /api/v1/crm/pipeline
   * Leads grouped by stage for kanban view
   */
  fastify.get('/pipeline', async (request, reply) => {
    const userId = requireUserId(request);

    const { data, error } = await supabaseAdmin
      .from('leads')
      .select(`
        id, status, opportunity_score,
        businesses(name, industry, city, website)
      `)
      .eq('user_id', userId)
      .order('opportunity_score', { ascending: false, nullsFirst: false });

    if (error) throw new Error(`Failed to load pipeline: ${error.message}`);

    // Seed every stage so the board renders all columns, including empty ones.
    const stages = [
      'discovered', 'analyzing', 'qualified', 'contacted',
      'meeting', 'proposal', 'negotiation', 'won', 'lost',
    ];
    type PipelineLead = NonNullable<typeof data>[number];
    const pipeline: Record<string, PipelineLead[]> = Object.fromEntries(
      stages.map((stage) => [stage, [] as PipelineLead[]])
    );

    for (const lead of data ?? []) {
      const stage = lead.status as string;
      (pipeline[stage] ??= []).push(lead);
    }

    return reply.send({ pipeline });
  });
}
