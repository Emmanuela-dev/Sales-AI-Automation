export type OutreachChannel = 'email' | 'whatsapp' | 'linkedin' | 'cold_call_script';

export interface OutreachMessage {
  id: string;
  lead_id: string;
  business_id: string;
  channel: OutreachChannel;
  subject?: string; // for email
  body: string;
  personalization_context?: string;
  sent_at?: string;
  opened_at?: string;
  replied_at?: string;
  status: 'draft' | 'sent' | 'opened' | 'replied' | 'bounced';
  generated_at: string;
}

export interface GenerateOutreachParams {
  lead_id: string;
  channels: OutreachChannel[];
  tone?: 'professional' | 'casual' | 'urgent';
  focus?: string; // e.g. "website redesign"
}
