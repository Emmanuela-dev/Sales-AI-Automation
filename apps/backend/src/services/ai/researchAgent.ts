import { generateJson } from '../../lib/openai';
import { supabaseAdmin } from '../../lib/supabase';
import type { Business, CompanyResearch, WebsiteAnalysis } from '@prospectai/shared';

interface ResearchResponse {
  summary?: string;
  industry?: string;
  employee_range?: string;
  estimated_revenue?: string;
  likely_needs?: unknown;
  estimated_budget_min?: unknown;
  estimated_budget_max?: unknown;
  currency?: string;
  pain_points?: unknown;
  recent_signals?: unknown;
}

/**
 * AI Company Research Agent
 * Generates a detailed company profile, identifies likely needs,
 * estimated budget, and sales signals.
 */
export async function runCompanyResearch(
  business: Business,
  websiteAnalysis?: Omit<WebsiteAnalysis, 'id' | 'business_id'> | null
): Promise<CompanyResearch> {
  const websiteContext = websiteAnalysis
    ? `
Website Analysis:
- Score: ${websiteAnalysis.score}/100
- HTTPS: ${websiteAnalysis.has_https ? 'Yes' : 'No'}
- Mobile Responsive: ${websiteAnalysis.is_mobile_responsive ? 'Yes' : 'No'}
- Has Booking Form: ${websiteAnalysis.has_booking_form ? 'Yes' : 'No'}
- Has Contact Form: ${websiteAnalysis.has_contact_form ? 'Yes' : 'No'}
- SEO Meta Tags: ${websiteAnalysis.has_seo_meta ? 'Yes' : 'No'}
- Issues: ${(websiteAnalysis.issues ?? []).map((i) => i.description).join('; ')}
- Tech Stack: ${websiteAnalysis.tech_stack?.join(', ') || 'Unknown'}
`
    : 'No website analysis available.';

  const prompt = `You are an expert B2B sales researcher. Analyze this business and provide a detailed company profile to help a digital agency identify sales opportunities.

Business Information:
- Name: ${business.name}
- Industry: ${business.industry}
- Location: ${business.city}, ${business.country}
- Google Rating: ${business.google_rating ?? 'N/A'} (${business.google_reviews_count ?? 0} reviews)
- Website: ${business.website ?? 'None'}
- Phone: ${business.phone ?? 'N/A'}

${websiteContext}

Respond ONLY with a valid JSON object using this exact structure:
{
  "summary": "2-3 sentence overview of the business",
  "industry": "refined industry category",
  "employee_range": "e.g. 10-30",
  "estimated_revenue": "e.g. KES 5M-15M/year",
  "likely_needs": ["need1", "need2", "need3"],
  "estimated_budget_min": 50000,
  "estimated_budget_max": 300000,
  "currency": "KES",
  "pain_points": ["pain1", "pain2"],
  "recent_signals": ["signal1", "signal2"]
}`;

  const raw = await generateJson<ResearchResponse>({
    prompt,
    temperature: 0.3,
    purpose: 'Company research',
  });

  const record = {
    business_id: business.id,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    industry: raw.industry ?? business.industry,
    employee_range: raw.employee_range ?? 'Unknown',
    estimated_revenue: raw.estimated_revenue,
    likely_needs: toStringArray(raw.likely_needs),
    estimated_budget_min: toInteger(raw.estimated_budget_min),
    estimated_budget_max: toInteger(raw.estimated_budget_max),
    currency: raw.currency ?? 'KES',
    pain_points: toStringArray(raw.pain_points),
    recent_signals: toStringArray(raw.recent_signals),
  };

  // Insert, letting Postgres assign the id and timestamps. This was previously
  // an upsert carrying a freshly generated UUID, which could never conflict, and
  // whose error was never checked — a failed save looked like a success.
  const { data, error } = await supabaseAdmin
    .from('company_research')
    .insert(record)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save company research: ${error.message}`);
  }

  return data as CompanyResearch;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => v != null).map(String);
}

/** Budget columns are INTEGER; the model sometimes returns "50,000" or "50000 KES". */
function toInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9.]/g, '');
    const parsed = Number(digits);
    if (Number.isFinite(parsed) && digits !== '') return Math.round(parsed);
  }
  return undefined;
}
