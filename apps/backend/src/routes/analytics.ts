import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase';
import { requireUserId } from '../lib/auth';

const PERIOD_DAYS: Record<string, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

const dashboardQuerySchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
});

const WON_OR_LATER = ['meeting', 'proposal', 'negotiation', 'won'];

export async function analyticsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/analytics/dashboard
   * Returns key metrics for the dashboard, scoped to the caller.
   */
  fastify.get('/dashboard', async (request, reply) => {
    const userId = requireUserId(request);
    const { period } = dashboardQuerySchema.parse(request.query);

    const since = new Date(Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000).toISOString();

    const [leads, outreach, proposals] = await Promise.all([
      supabaseAdmin
        .from('leads')
        .select('id, business_id, status, opportunity_score')
        .eq('user_id', userId)
        .gte('created_at', since),
      // Outreach and proposals have no user_id of their own — they belong to a
      // lead, so scope them through an inner join on the lead's owner.
      supabaseAdmin
        .from('outreach_messages')
        .select('id, status, leads!inner(user_id)')
        .eq('leads.user_id', userId)
        .gte('generated_at', since),
      supabaseAdmin
        .from('proposals')
        .select('id, status, total_cost_min, total_cost_max, leads!inner(user_id)')
        .eq('leads.user_id', userId)
        .gte('generated_at', since),
    ]);

    if (leads.error) throw new Error(`Failed to load lead metrics: ${leads.error.message}`);
    if (outreach.error) throw new Error(`Failed to load outreach metrics: ${outreach.error.message}`);
    if (proposals.error) throw new Error(`Failed to load proposal metrics: ${proposals.error.message}`);

    const leadsData = leads.data ?? [];
    const proposalsData = proposals.data ?? [];

    // Businesses are shared across users, so the only per-user "found" figure
    // available is the distinct businesses this user actually saved.
    const businessesFound = new Set(leadsData.map((l) => l.business_id)).size;

    const emailsSent = (outreach.data ?? []).filter((m) => m.status !== 'draft').length;
    const meetingsBooked = leadsData.filter((l) => WON_OR_LATER.includes(l.status)).length;
    const clientsWon = leadsData.filter((l) => l.status === 'won').length;
    const highValueProspects = leadsData.filter((l) => (l.opportunity_score ?? 0) >= 75).length;

    const revenue = proposalsData
      .filter((p) => p.status === 'accepted')
      .reduce((sum, p) => sum + ((p.total_cost_min ?? 0) + (p.total_cost_max ?? 0)) / 2, 0);

    return reply.send({
      businesses_found: businessesFound,
      high_value_prospects: highValueProspects,
      emails_sent: emailsSent,
      meetings_booked: meetingsBooked,
      clients_won: clientsWon,
      revenue_total: revenue,
      currency: 'KES',
      period,
    });
  });

  /**
   * GET /api/v1/analytics/pipeline
   * Stage-by-stage funnel stats
   */
  fastify.get('/pipeline', async (request, reply) => {
    const userId = requireUserId(request);
    const stages = [
      'discovered', 'analyzing', 'qualified', 'contacted',
      'meeting', 'proposal', 'negotiation', 'won', 'lost',
    ];

    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('status')
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to load pipeline stats: ${error.message}`);

    const counts = (data ?? []).reduce((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return reply.send({
      pipeline: stages.map((stage) => ({ stage, count: counts[stage] ?? 0 })),
    });
  });
}
