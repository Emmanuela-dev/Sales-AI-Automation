import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { generateOutreachMessages } from '../services/ai/outreachGenerator';

const uuidParam = z.object({ id: z.string().uuid() });

const generateSchema = z.object({
  lead_id: z.string().uuid(),
  channels: z.array(z.enum(['email', 'whatsapp', 'linkedin', 'cold_call_script'])).min(1),
  tone: z.enum(['professional', 'casual', 'urgent']).default('professional'),
  focus: z.string().optional(),
});

const updateSchema = z.object({
  status: z.enum(['draft', 'sent', 'opened', 'replied', 'bounced']).optional(),
  body: z.string().optional(),
  subject: z.string().optional(),
});

export async function outreachRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/outreach/lead/:id
   * List all outreach messages for a lead
   */
  fastify.get('/lead/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);
    const { data, error } = await supabaseAdmin
      .from('outreach_messages')
      .select('*')
      .eq('lead_id', id)
      .order('generated_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ messages: data });
  });

  /**
   * POST /api/v1/outreach/generate
   * AI-generate personalized outreach for a lead
   */
  fastify.post('/generate', async (request, reply) => {
    const params = generateSchema.parse(request.body);
    const messages = await generateOutreachMessages(params);
    return reply.code(201).send({ messages });
  });

  /**
   * PATCH /api/v1/outreach/:id
   * Update message status or content
   */
  fastify.patch('/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);
    const updates = updateSchema.parse(request.body);

    const patch: Record<string, unknown> = { ...updates };
    if (updates.status === 'sent') patch.sent_at = new Date().toISOString();
    if (updates.status === 'opened') patch.opened_at = new Date().toISOString();
    if (updates.status === 'replied') patch.replied_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('outreach_messages')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ message: data });
  });
}
