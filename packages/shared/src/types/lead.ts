export type LeadStatus =
  | 'discovered'
  | 'analyzing'
  | 'qualified'
  | 'contacted'
  | 'meeting'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export interface Lead {
  id: string;
  business_id: string;
  user_id: string;
  status: LeadStatus;
  opportunity_score?: number;
  score_reasons?: string[];
  notes?: string;
  assigned_to?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}
