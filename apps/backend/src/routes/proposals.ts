import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { generateProposal } from '../services/ai/proposalGenerator';
import { assertLeadOwned, NotFoundError, requireUserId } from '../lib/auth';

const uuidParam = z.object({ id: z.string().uuid() });

const generateSchema = z.object({
  lead_id: z.string().uuid(),
  services: z.array(z.string().min(1)).min(1).max(20),
  budget_range: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
      currency: z.string().default('KES'),
    })
    .refine((range) => range.max >= range.min, {
      message: 'budget_range.max must be greater than or equal to budget_range.min',
    })
    .optional(),
  custom_notes: z.string().max(2000).optional(),
});

const updateSchema = z
  .object({
    status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'negotiating']).optional(),
    title: z.string().min(1).optional(),
    executive_summary: z.string().optional(),
    valid_until: z.string().date().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' });

export async function proposalRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/proposals/lead/:id
   */
  fastify.get('/lead/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = uuidParam.parse(request.params);
    await assertLeadOwned(id, userId);

    const { data, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('lead_id', id)
      .order('generated_at', { ascending: false });

    if (error) throw new Error(`Failed to load proposals: ${error.message}`);
    return reply.send({ proposals: data ?? [] });
  });

  /**
   * GET /api/v1/proposals/:id
   */
  fastify.get('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = uuidParam.parse(request.params);

    const { data, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to load proposal: ${error.message}`);
    if (!data) throw new NotFoundError('Proposal not found');
    await assertLeadOwned(data.lead_id, userId);

    return reply.send({ proposal: data });
  });

  /**
   * POST /api/v1/proposals/generate
   * AI-generate a proposal for a lead
   */
  fastify.post('/generate', async (request, reply) => {
    const userId = requireUserId(request);
    const params = generateSchema.parse(request.body);
    await assertLeadOwned(params.lead_id, userId);

    const proposal = await generateProposal(params);
    return reply.code(201).send({ proposal });
  });

  /**
   * PATCH /api/v1/proposals/:id
   */
  fastify.patch('/:id', async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = uuidParam.parse(request.params);
    const updates = updateSchema.parse(request.body);

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('proposals')
      .select('id, lead_id')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) throw new Error(`Failed to load proposal: ${lookupError.message}`);
    if (!existing) throw new NotFoundError('Proposal not found');
    await assertLeadOwned(existing.lead_id, userId);

    const { data, error } = await supabaseAdmin
      .from('proposals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update proposal: ${error.message}`);
    return reply.send({ proposal: data });
  });
}
