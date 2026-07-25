import { openai, DEFAULT_MODEL } from '../../lib/openai';
import { supabaseAdmin } from '../../lib/supabase';
import type { Proposal, GenerateProposalParams } from '@prospectai/shared';

/**
 * AI Proposal Generator
 * Drafts a full project proposal based on lead data and requested services
 */
export async function generateProposal(params: GenerateProposalParams): Promise<Proposal> {
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('*, businesses(*)')
    .eq('id', params.lead_id)
    .single();

  if (!lead) throw new Error('Lead not found');

  const biz = (lead as { businesses: Record<string, unknown> }).businesses;

  const { data: research } = await supabaseAdmin
    .from('company_research')
    .select('*')
    .eq('business_id', lead.business_id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const budgetInfo = params.budget_range
    ? `Budget range: ${params.budget_range.currency} ${params.budget_range.min.toLocaleString()} - ${params.budget_range.max.toLocaleString()}`
    : research
    ? `Estimated budget: ${research.currency} ${research.estimated_budget_min?.toLocaleString()} - ${research.estimated_budget_max?.toLocaleString()}`
    : 'Budget: Not specified';

  const prompt = `You are a senior project manager at a digital agency. Create a detailed project proposal.

Client: ${biz.name} (${biz.industry}, ${biz.city}, ${biz.country})
Services Requested: ${params.services.join(', ')}
${budgetInfo}
${params.custom_notes ? `Additional Notes: ${params.custom_notes}` : ''}
${research ? `Client Needs: ${(research.likely_needs as string[])?.join(', ')}` : ''}

Respond ONLY with valid JSON matching this structure exactly:
{
  "title": "Project title",
  "executive_summary": "2-3 paragraph summary",
  "scope": [
    { "title": "Phase name", "description": "What will be done", "cost_estimate": 50000 }
  ],
  "deliverables": ["deliverable1", "deliverable2"],
  "timeline_weeks": 8,
  "milestones": [
    {
      "name": "Milestone name",
      "description": "What happens",
      "duration_weeks": 2,
      "deliverables": ["item1"],
      "payment_percentage": 30
    }
  ],
  "total_cost_min": 150000,
  "total_cost_max": 250000,
  "currency": "KES",
  "payment_terms": "30% upfront, 40% midpoint, 30% on delivery"
}`;

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  const raw = JSON.parse(response.choices[0].message.content ?? '{}');

  const proposal: Proposal = {
    id: crypto.randomUUID(),
    lead_id: params.lead_id,
    business_id: lead.business_id,
    title: raw.title ?? `Proposal for ${biz.name}`,
    executive_summary: raw.executive_summary ?? '',
    scope: raw.scope ?? [],
    deliverables: raw.deliverables ?? [],
    timeline_weeks: raw.timeline_weeks ?? 8,
    milestones: raw.milestones ?? [],
    total_cost_min: raw.total_cost_min ?? 0,
    total_cost_max: raw.total_cost_max ?? 0,
    currency: raw.currency ?? 'KES',
    payment_terms: raw.payment_terms,
    status: 'draft',
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await supabaseAdmin.from('proposals').insert(proposal);

  return proposal;
}
