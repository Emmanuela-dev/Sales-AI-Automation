import { generateText } from '../../lib/openai';
import { supabaseAdmin } from '../../lib/supabase';

const STALE_AFTER_DAYS = 5;
const ACTIVE_STATUSES = ['contacted', 'meeting', 'proposal'];

interface BusinessRef {
  name: string;
  industry: string;
  city: string;
}

interface StaleLead {
  id: string;
  status: string;
  user_id: string | null;
  updated_at: string;
  /** PostgREST returns embedded relations as an object or an array of one. */
  businesses: BusinessRef | BusinessRef[] | null;
}

function businessOf(lead: StaleLead): BusinessRef | null {
  if (!lead.businesses) return null;
  return Array.isArray(lead.businesses) ? lead.businesses[0] ?? null : lead.businesses;
}

export interface FollowUpCheckResult {
  scanned: number;
  created: number;
  skipped: number;
  failed: number;
}

/**
 * Follow-up Agent
 * Detects stale leads and schedules intelligent follow-up suggestions
 */
export async function runFollowUpCheck(): Promise<FollowUpCheckResult> {
  const staleBefore = new Date(
    Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: staleLeads, error } = await supabaseAdmin
    .from('leads')
    .select(`
      id, status, user_id, updated_at,
      businesses(name, industry, city)
    `)
    .in('status', ACTIVE_STATUSES)
    .lt('updated_at', staleBefore);

  if (error) {
    throw new Error(`Failed to load stale leads: ${error.message}`);
  }

  const leads = (staleLeads as unknown as StaleLead[] | null) ?? [];
  const result: FollowUpCheckResult = { scanned: leads.length, created: 0, skipped: 0, failed: 0 };

  for (const lead of leads) {
    try {
      if (await hasPendingFollowUp(lead.id)) {
        result.skipped++;
        continue;
      }

      const suggestion = await generateFollowUpMessage(lead);

      const { error: insertError } = await supabaseAdmin.from('follow_ups').insert({
        lead_id: lead.id,
        // Attribute the reminder to the lead's owner so it shows up for the
        // right person, rather than to a literal 'system' user.
        user_id: lead.user_id ?? 'system',
        trigger_type: lead.status === 'proposal' ? 'proposal_expiring' : 'no_response',
        message_suggestion: suggestion,
        due_at: new Date().toISOString(),
        status: 'pending',
      });

      if (insertError) throw new Error(insertError.message);
      result.created++;
    } catch (err) {
      // One bad lead shouldn't abort the whole sweep.
      result.failed++;
      console.error(`[FollowUpAgent] Lead ${lead.id} failed:`, (err as Error).message);
    }
  }

  return result;
}

/**
 * A lead can legitimately accumulate more than one pending follow-up, and
 * maybeSingle() reports that as an error rather than throwing — which the
 * caller previously discarded, treating it as "none pending" and creating a
 * duplicate on every sweep. Count instead.
 */
async function hasPendingFollowUp(leadId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('follow_ups')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .eq('status', 'pending');

  if (error) throw new Error(`Failed to check existing follow-ups: ${error.message}`);
  return (count ?? 0) > 0;
}

async function generateFollowUpMessage(lead: StaleLead): Promise<string> {
  const biz = businessOf(lead);
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const prompt = `Write a brief, friendly follow-up message for a prospect that hasn't responded in ${daysSinceUpdate} days.

Prospect: ${biz?.name ?? 'this prospect'} (${biz?.industry ?? 'unknown industry'}, ${biz?.city ?? 'unknown city'})
Current Stage: ${lead.status}

Keep it under 80 words. Be polite, not pushy. Reference their business name. End with a soft question.
Respond with just the message text, no JSON.`;

  const message = await generateText({
    prompt,
    temperature: 0.7,
    maxTokens: 200,
    purpose: 'Follow-up message generation',
  });

  // message_suggestion is NOT NULL, so never hand the database an empty string.
  return (
    message ||
    `Following up to check if you had a chance to review our proposal for ${biz?.name ?? 'your business'}.`
  );
}
