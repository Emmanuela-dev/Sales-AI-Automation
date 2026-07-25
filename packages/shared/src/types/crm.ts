export interface CrmActivity {
  id: string;
  lead_id: string;
  user_id: string;
  type: 'note' | 'call' | 'email' | 'meeting' | 'stage_change' | 'follow_up';
  title: string;
  description?: string;
  scheduled_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface FollowUp {
  id: string;
  lead_id: string;
  user_id: string;
  trigger_type: 'no_response' | 'scheduled' | 'meeting_reminder' | 'proposal_expiring';
  message_suggestion: string;
  due_at: string;
  status: 'pending' | 'sent' | 'dismissed';
  created_at: string;
}
