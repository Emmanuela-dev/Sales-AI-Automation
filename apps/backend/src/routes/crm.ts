import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';

const uuidParam = z.object({ id: z.string().uuid() });

const activitySchema = z.object({
  lead_id: z.string().uuid(),
  type: z.enum(['note', 'call', 'email', 'meeting', 'stage_change', 'follow_up']),
  title: z.string().min(1),
  description: z.string().optional(),
  scheduled_at: z.string().optional(),
});

const followUpSchema = z.object({
  lead_id: z.string().uuid(),
  trigger_type: z.enum(['no_response', 'scheduled', 'meeting_reminder', 'proposal_expiring']),
  message_suggestion: z.string(),
  due_at: z.string(),
});

export async function crmRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/crm/activities/:lead_id
   */
  fastify.get('/activities/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);
    const { data, error } = await supabaseAdmin
      .from('crm_activities')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ activities: data });
  });

  /**
   * POST /api/v1/crm/activities
   */
  fastify.post('/activities', async (request, reply) => {
    const body = activitySchema.parse(request.body);
    const { data, error } = await supabaseAdmin
      .from('crm_activities')
      .insert({ ...body, user_id: 'system' })
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(201).send({ activity: data });
  });

  /**
   * GET /api/v1/crm/follow-ups
   * Pending follow-ups due today or overdue
   */
  fastify.get('/follow-ups', async (_request, reply) => {
    const { data, error } = await supabaseAdmin
      .from('follow_ups')
      .select(`*, leads(*, businesses(name, industry))`)
      .eq('status', 'pending')
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true });

    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ follow_ups: data });
  });

  /**
   * POST /api/v1/crm/follow-ups
   */
  fastify.post('/follow-ups', async (request, reply) => {
    const body = followUpSchema.parse(request.body);
    const { data, error } = await supabaseAdmin
      .from('follow_ups')
      .insert({ ...body, user_id: 'system', status: 'pending' })
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(201).send({ follow_up: data });
  });

  /**
   * PATCH /api/v1/crm/follow-ups/:id
   * Mark follow-up as sent or dismissed
   */
  fastify.patch('/follow-ups/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);
    const { status } = z.object({
      status: z.enum(['sent', 'dismissed']),
    }).parse(request.body);

    const { data, error } = await supabaseAdmin
      .from('follow_ups')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ follow_up: data });
  });

  /**
   * GET /api/v1/crm/pipeline
   * Leads grouped by stage for kanban view
   */
  fastify.get('/pipeline', async (_request, reply) => {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select(`
        id, status, opportunity_score,
        businesses(name, industry, city, website)
      `)
      .order('opportunity_score', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });

    // Group by status
    const pipeline = (data ?? []).reduce(
      (acc, lead) => {
        const stage = lead.status as string;
        if (!acc[stage]) acc[stage] = [];
        acc[stage].push(lead);
        return acc;
      },
      {} as Record<string, typeof data>
    );

    return reply.send({ pipeline });
  });
}
