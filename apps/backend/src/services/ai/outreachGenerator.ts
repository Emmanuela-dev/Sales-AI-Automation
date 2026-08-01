import { generateJson, AIError } from '../../lib/openai';
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

  const context = buildContext(biz, research, params);

  // Channels are independent, so generate them concurrently instead of waiting
  // for each round trip in turn.
  const generated = await Promise.all(
    params.channels.map(async (channel) => ({
      channel,
      content: await generateForChannel(channel, context, params.tone ?? 'professional'),
    }))
  );

  const rows = generated.map(({ channel, content }) => ({
    lead_id: params.lead_id,
    business_id: lead.business_id,
    channel,
    subject: content.subject ?? null,
    body: content.body,
    personalization_context: context,
    status: 'draft' as const,
  }));

  const { data, error } = await supabaseAdmin.from('outreach_messages').insert(rows).select();

  if (error) {
    throw new Error(`Failed to save outreach messages: ${error.message}`);
  }

  return (data as OutreachMessage[]) ?? [];
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

  const raw = await generateJson<{ subject?: unknown; body?: unknown }>({
    prompt,
    temperature: 0.7,
    purpose: `Outreach generation (${channel})`,
  });

  const body = typeof raw.body === 'string' ? raw.body.trim() : '';

  // outreach_messages.body is NOT NULL — inserting an empty body would fail at
  // the database with an opaque constraint error, so reject it here instead.
  if (!body) {
    throw new AIError(
      `Outreach generation (${channel}) returned no message body. Try again, or adjust the focus.`
    );
  }

  const subject = typeof raw.subject === 'string' && raw.subject.trim() ? raw.subject.trim() : undefined;

  return channel === 'email' ? { subject, body } : { body };
}
