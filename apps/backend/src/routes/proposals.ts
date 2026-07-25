import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { generateProposal } from '../services/ai/proposalGenerator';

const uuidParam = z.object({ id: z.string().uuid() });

const generateSchema = z.object({
  lead_id: z.string().uuid(),
  services: z.array(z.string()).min(1),
  budget_range: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string().default('KES'),
  }).optional(),
  custom_notes: z.string().optional(),
});

const updateSchema = z.object({
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'negotiating']).optional(),
  title: z.string().optional(),
  executive_summary: z.string().optional(),
  valid_until: z.string().optional(),
});

export async function proposalRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/proposals/lead/:id
   */
  fastify.get('/lead/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);
    const { data, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('lead_id', id)
      .order('generated_at', { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ proposals: data });
  });

  /**
   * GET /api/v1/proposals/:id
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);
    const { data, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return reply.code(404).send({ error: 'Proposal not found' });
    return reply.send({ proposal: data });
  });

  /**
   * POST /api/v1/proposals/generate
   * AI-generate a proposal for a lead
   */
  fastify.post('/generate', async (request, reply) => {
    const params = generateSchema.parse(request.body);
    const proposal = await generateProposal(params);
    return reply.code(201).send({ proposal });
  });

  /**
   * PATCH /api/v1/proposals/:id
   */
  fastify.patch('/:id', async (request, reply) => {
    const { id } = uuidParam.parse(request.params);
    const updates = updateSchema.parse(request.body);

    const { data, error } = await supabaseAdmin
      .from('proposals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return reply.send({ proposal: data });
  });
}
