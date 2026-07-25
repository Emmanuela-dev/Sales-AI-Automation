import { openai, DEFAULT_MODEL } from '../../lib/openai';
import { supabaseAdmin } from '../../lib/supabase';
import type { Business, CompanyResearch, WebsiteAnalysis } from '@prospectai/shared';

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
- Issues: ${websiteAnalysis.issues.map(i => i.description).join('; ')}
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

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const raw = JSON.parse(response.choices[0].message.content ?? '{}');

  const research: CompanyResearch = {
    id: crypto.randomUUID(),
    business_id: business.id,
    summary: raw.summary ?? '',
    industry: raw.industry ?? business.industry,
    employee_range: raw.employee_range ?? 'Unknown',
    estimated_revenue: raw.estimated_revenue,
    likely_needs: raw.likely_needs ?? [],
    estimated_budget_min: raw.estimated_budget_min,
    estimated_budget_max: raw.estimated_budget_max,
    currency: raw.currency ?? 'KES',
    pain_points: raw.pain_points ?? [],
    recent_signals: raw.recent_signals ?? [],
    generated_at: new Date().toISOString(),
  };

  // Save to database
  await supabaseAdmin.from('company_research').upsert({
    ...research,
    updated_at: new Date().toISOString(),
  });

  return research;
}
