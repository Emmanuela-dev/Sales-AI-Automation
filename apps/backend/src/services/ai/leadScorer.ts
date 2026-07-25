import { openai, DEFAULT_MODEL } from '../../lib/openai';
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
 * AI Lead Scoring Agent
 * Analyzes all available data on a business and returns an opportunity score 0-100
 */
export async function scoreLead(input: ScoringInput): Promise<ScoreResult> {
  // Gather all data
  const [bizResult, analysisResult, researchResult] = await Promise.all([
    supabaseAdmin.from('businesses').select('*').eq('id', input.business_id).single(),
    supabaseAdmin.from('website_analyses').select('*').eq('business_id', input.business_id).order('analyzed_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('company_research').select('*').eq('business_id', input.business_id).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

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

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const raw = JSON.parse(response.choices[0].message.content ?? '{}');
  const result: ScoreResult = {
    score: Math.min(100, Math.max(0, Number(raw.score) || 50)),
    reasons: Array.isArray(raw.reasons) ? raw.reasons : [],
  };

  // Save score back to lead
  await supabaseAdmin
    .from('leads')
    .update({
      opportunity_score: result.score,
      score_reasons: result.reasons,
      status: result.score >= 70 ? 'qualified' : 'discovered',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.lead_id);

  return result;
}
