import { generateJson } from '../../lib/openai';
import { supabaseAdmin } from '../../lib/supabase';

interface ScoringInput {
  lead_id: string;
  business_id: string;
}

interface ScoreResult {
  score: number;
  reasons: string[];
}

/**
 * Stages that scoring is allowed to advance a lead out of. Once a human has
 * moved a lead to 'contacted' or beyond, re-scoring must not rewind it — that
 * would silently undo real sales progress.
 */
const AUTO_ADVANCEABLE_STATUSES = ['discovered', 'analyzing'];
const QUALIFICATION_THRESHOLD = 70;

/**
 * AI Lead Scoring Agent
 * Analyzes all available data on a business and returns an opportunity score 0-100
 */
export async function scoreLead(input: ScoringInput): Promise<ScoreResult> {
  // Gather all data
  const [leadResult, bizResult, analysisResult, researchResult] = await Promise.all([
    supabaseAdmin.from('leads').select('id, status').eq('id', input.lead_id).maybeSingle(),
    supabaseAdmin.from('businesses').select('*').eq('id', input.business_id).maybeSingle(),
    supabaseAdmin.from('website_analyses').select('*').eq('business_id', input.business_id).order('analyzed_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('company_research').select('*').eq('business_id', input.business_id).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const lead = leadResult.data;
  const biz = bizResult.data;
  const analysis = analysisResult.data;
  const research = researchResult.data;

  if (!biz) {
    return { score: 50, reasons: ['Insufficient data to score accurately'] };
  }

  const prompt = `You are an AI sales scoring agent for a digital agency. Score this prospect's sales opportunity from 0-100 and explain the top reasons.

Business: ${biz.name} (${biz.industry}, ${biz.city})
Google Rating: ${biz.google_rating ?? 'N/A'} | Reviews: ${biz.google_reviews_count ?? 0}
Has Website: ${biz.website ? 'Yes' : 'No'}
${analysis ? `Website Score: ${analysis.score}/100 | Issues: ${analysis.issues?.length ?? 0}` : 'No website analysis'}
${research ? `Estimated Budget: ${research.currency} ${research.estimated_budget_min}-${research.estimated_budget_max}\nLikely Needs: ${research.likely_needs?.join(', ')}` : ''}

Scoring criteria (positive signals):
- Active business with many reviews = higher engagement
- Poor or missing website = clear opportunity to sell services
- No mobile optimization = urgent need
- No booking form = lost revenue for them
- Missing SEO = organic visibility problem
- High Google rating = credibility, can afford to invest
- Growing number of reviews = business is scaling

Scoring criteria (negative signals):
- No website = may have low budget
- Very few reviews = small or struggling business

Respond ONLY with JSON:
{
  "score": 82,
  "reasons": [
    "Active business with 120+ Google reviews",
    "Website lacks mobile optimization",
    "No online booking system detected",
    "Strong Google rating of 4.3 suggests budget availability"
  ]
}`;

  const raw = await generateJson<{ score?: unknown; reasons?: unknown }>({
    prompt,
    temperature: 0.2,
    purpose: 'Lead scoring',
  });

  const parsedScore = Number(raw.score);
  const result: ScoreResult = {
    score: Number.isFinite(parsedScore) ? Math.min(100, Math.max(0, Math.round(parsedScore))) : 50,
    reasons: Array.isArray(raw.reasons) ? raw.reasons.map(String) : [],
  };

  const updates: Record<string, unknown> = {
    opportunity_score: result.score,
    score_reasons: result.reasons,
    updated_at: new Date().toISOString(),
  };

  // Only ever move a lead forward, and only out of the early stages.
  const currentStatus = lead?.status as string | undefined;
  if (
    result.score >= QUALIFICATION_THRESHOLD &&
    currentStatus &&
    AUTO_ADVANCEABLE_STATUSES.includes(currentStatus)
  ) {
    updates.status = 'qualified';
  }

  const { error } = await supabaseAdmin.from('leads').update(updates).eq('id', input.lead_id);
  if (error) {
    throw new Error(`Failed to save lead score: ${error.message}`);
  }

  return result;
}
