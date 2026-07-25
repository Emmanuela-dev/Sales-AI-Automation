import { openai, DEFAULT_MODEL } from '../../lib/openai';
import { supabaseAdmin } from '../../lib/supabase';
import type { OutreachMessage, OutreachChannel, GenerateOutreachParams } from '@prospectai/shared';

/**
 * AI Outreach Generator
 * Creates personalized, channel-specific sales messages
 */
export async function generateOutreachMessages(
  params: GenerateOutreachParams
): Promise<OutreachMessage[]> {
  // Fetch lead + business + research
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

  const context = buildContext(biz as Record<string, unknown>, research, params);

  const messages: OutreachMessage[] = [];

  for (const channel of params.channels) {
    const content = await generateForChannel(channel, context, params.tone ?? 'professional');
    const msg: OutreachMessage = {
      id: crypto.randomUUID(),
      lead_id: params.lead_id,
      business_id: lead.business_id,
      channel,
      subject: content.subject,
      body: content.body,
      personalization_context: context,
      status: 'draft',
      generated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('outreach_messages').insert(msg);
    messages.push(msg);
  }

  return messages;
}

function buildContext(
  biz: Record<string, unknown>,
  research: Record<string, unknown> | null,
  params: GenerateOutreachParams
): string {
  return `
Business: ${biz.name} (${biz.industry}, ${biz.city})
Website: ${biz.website ?? 'None'}
Google Rating: ${biz.google_rating ?? 'N/A'}
Likely Needs: ${research?.likely_needs ? (research.likely_needs as string[]).join(', ') : 'Website improvements'}
Pain Points: ${research?.pain_points ? (research.pain_points as string[]).join(', ') : 'Not analyzed'}
Budget Range: ${research ? `${research.currency} ${research.estimated_budget_min}-${research.estimated_budget_max}` : 'Unknown'}
Focus Area: ${params.focus ?? 'general digital transformation'}
`.trim();
}

async function generateForChannel(
  channel: OutreachChannel,
  context: string,
  tone: string
): Promise<{ subject?: string; body: string }> {
  const instructions: Record<OutreachChannel, string> = {
    email: `Write a cold sales email. Include: subject line, personalized opener, value proposition referencing their specific gaps, a clear CTA. Max 200 words. Tone: ${tone}.`,
    whatsapp: `Write a short WhatsApp cold outreach message. Conversational, direct, max 80 words. No formal greetings. Include a question at the end. Tone: ${tone}.`,
    linkedin: `Write a LinkedIn connection request message (max 300 chars) followed by a follow-up DM (max 150 words). Tone: professional.`,
    cold_call_script: `Write a cold call script with: opener, qualifying questions, value pitch, objection handling, and closing. Structure it clearly with section labels.`,
  };

  const prompt = `You are a B2B sales copywriter for a digital agency. Using the prospect details below, write outreach content.

Prospect Context:
${context}

Task: ${instructions[channel]}

Respond ONLY with JSON:
${channel === 'email' ? '{"subject": "...", "body": "..."}' : '{"body": "..."}'}`;

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content ?? '{"body": ""}');
}
