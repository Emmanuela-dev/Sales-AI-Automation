import { openai, DEFAULT_MODEL } from '../../lib/openai';
import { supabaseAdmin } from '../../lib/supabase';

/**
 * Follow-up Agent
 * Detects stale leads and schedules intelligent follow-up suggestions
 */
export async function runFollowUpCheck(): Promise<void> {
  const { data: stalLeads } = await supabaseAdmin
    .from('leads')
    .select(`
      id, status, updated_at,
      businesses(name, industry, city)
    `)
    .in('status', ['contacted', 'meeting', 'proposal'])
    .lt('updated_at', new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()); // 5 days stale

  if (!stalLeads || stalLeads.length === 0) return;

  for (const lead of stalLeads) {
    // Check if a follow-up already exists for this lead
    const { data: existing } = await supabaseAdmin
      .from('follow_ups')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) continue; // Already has a pending follow-up

    const suggestion = await generateFollowUpMessage(lead);

    await supabaseAdmin.from('follow_ups').insert({
      lead_id: lead.id,
      user_id: 'system',
      trigger_type: lead.status === 'proposal' ? 'proposal_expiring' : 'no_response',
      message_suggestion: suggestion,
      due_at: new Date().toISOString(),
      status: 'pending',
    });
  }
}

async function generateFollowUpMessage(lead: Record<string, unknown>): Promise<string> {
  const biz = lead.businesses as Record<string, unknown>;
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(lead.updated_at as string).getTime()) / (1000 * 60 * 60 * 24)
  );

  const prompt = `Write a brief, friendly follow-up message for a prospect that hasn't responded in ${daysSinceUpdate} days.

Prospect: ${biz?.name} (${biz?.industry}, ${biz?.city})
Current Stage: ${lead.status}

Keep it under 80 words. Be polite, not pushy. Reference their business name. End with a soft question.
Respond with just the message text, no JSON.`;

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 150,
  });

  return response.choices[0].message.content?.trim() ?? 'Following up to check if you had a chance to review our proposal.';
}
