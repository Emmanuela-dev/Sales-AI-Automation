import { generateJson } from '../../lib/openai';
import { supabaseAdmin } from '../../lib/supabase';
import type {
  Proposal,
  ProposalMilestone,
  ProposalSection,
  GenerateProposalParams,
} from '@prospectai/shared';

interface ProposalResponse {
  title?: unknown;
  executive_summary?: unknown;
  scope?: unknown;
  deliverables?: unknown;
  timeline_weeks?: unknown;
  milestones?: unknown;
  total_cost_min?: unknown;
  total_cost_max?: unknown;
  currency?: unknown;
  payment_terms?: unknown;
}

/**
 * AI Proposal Generator
 * Drafts a full project proposal based on lead data and requested services
 */
export async function generateProposal(params: GenerateProposalParams): Promise<Proposal> {
  const { data: lead, error: leadError } = await supabaseAdmin
    .from('leads')
    .select('*, businesses(*)')
    .eq('id', params.lead_id)
    .maybeSingle();

  if (leadError) throw new Error(`Failed to load lead: ${leadError.message}`);
  if (!lead) throw new Error('Lead not found');

  const biz = (lead as { businesses: Record<string, unknown> | null }).businesses;
  if (!biz) throw new Error('Lead is not linked to a business');

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

  const raw = await generateJson<ProposalResponse>({
    prompt,
    temperature: 0.4,
    purpose: 'Proposal generation',
  });

  // Coerce every field the schema declares NOT NULL, so a partial model
  // response can't turn into a constraint violation at insert time.
  const costMin = toInteger(raw.total_cost_min) ?? params.budget_range?.min ?? 0;
  const costMax = toInteger(raw.total_cost_max) ?? params.budget_range?.max ?? costMin;

  const record = {
    lead_id: params.lead_id,
    business_id: lead.business_id,
    title: toText(raw.title) || `Proposal for ${biz.name}`,
    executive_summary: toText(raw.executive_summary),
    scope: toScope(raw.scope),
    deliverables: toStringArray(raw.deliverables),
    timeline_weeks: toInteger(raw.timeline_weeks) ?? 8,
    milestones: toMilestones(raw.milestones),
    total_cost_min: Math.min(costMin, costMax),
    total_cost_max: Math.max(costMin, costMax),
    currency: toText(raw.currency) || params.budget_range?.currency || 'KES',
    payment_terms: toText(raw.payment_terms) || null,
    status: 'draft' as const,
  };

  const { data, error } = await supabaseAdmin.from('proposals').insert(record).select().single();

  if (error) {
    throw new Error(`Failed to save proposal: ${error.message}`);
  }

  return data as Proposal;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => v != null).map(String);
}

/** Model output can omit fields or return numbers as strings; normalize both. */
function toInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9.]/g, '');
    const parsed = Number(digits);
    if (digits !== '' && Number.isFinite(parsed)) return Math.round(parsed);
  }
  return undefined;
}

function toScope(value: unknown): ProposalSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      title: toText(item.title),
      description: toText(item.description),
      cost_estimate: toInteger(item.cost_estimate),
    }));
}

function toMilestones(value: unknown): ProposalMilestone[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      name: toText(item.name),
      description: toText(item.description),
      duration_weeks: toInteger(item.duration_weeks) ?? 0,
      deliverables: toStringArray(item.deliverables),
      payment_percentage: toInteger(item.payment_percentage) ?? 0,
    }));
}
