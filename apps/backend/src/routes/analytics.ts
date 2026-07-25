import { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../lib/supabase';

export async function analyticsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/analytics/dashboard
   * Returns key metrics for the dashboard
   */
  fastify.get('/dashboard', async (request, reply) => {
    const query = request.query as { period?: string };
    const period = query.period || 'month';

    const periodMap: Record<string, string> = {
      week: '7 days',
      month: '30 days',
      quarter: '90 days',
      year: '365 days',
    };
    const interval = periodMap[period] ?? '30 days';
    const since = new Date(Date.now() - parseInterval(interval)).toISOString();

    const [businesses, leads, outreach, proposals] = await Promise.all([
      supabaseAdmin.from('businesses').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabaseAdmin.from('leads').select('id, status, opportunity_score', { count: 'exact' }).gte('created_at', since),
      supabaseAdmin.from('outreach_messages').select('id, status', { count: 'exact' }).gte('generated_at', since),
      supabaseAdmin.from('proposals').select('id, status, total_cost_min, total_cost_max').gte('generated_at', since),
    ]);

    const leadsData = leads.data ?? [];
    const proposalsData = proposals.data ?? [];

    const emailsSent = (outreach.data ?? []).filter(m => m.status !== 'draft').length;
    const meetingsBooked = leadsData.filter(l => ['meeting', 'proposal', 'negotiation', 'won'].includes(l.status)).length;
    const clientsWon = leadsData.filter(l => l.status === 'won').length;
    const highValueProspects = leadsData.filter(l => (l.opportunity_score ?? 0) >= 75).length;

    const revenue = proposalsData
      .filter(p => p.status === 'accepted')
      .reduce((sum, p) => sum + ((p.total_cost_min + p.total_cost_max) / 2), 0);

    return reply.send({
      businesses_found: businesses.count ?? 0,
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
  fastify.get('/pipeline', async (_request, reply) => {
    const stages = ['discovered', 'analyzing', 'qualified', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost'];
    const { data } = await supabaseAdmin.from('leads').select('status');

    const counts = (data ?? []).reduce((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const pipeline = stages.map(stage => ({
      stage,
      count: counts[stage] ?? 0,
    }));

    return reply.send({ pipeline });
  });
}

function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)\s+days?$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  return Number(match[1]) * 24 * 60 * 60 * 1000;
}
