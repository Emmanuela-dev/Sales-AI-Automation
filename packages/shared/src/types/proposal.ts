export interface Proposal {
  id: string;
  lead_id: string;
  business_id: string;
  title: string;
  executive_summary: string;
  scope: ProposalSection[];
  deliverables: string[];
  timeline_weeks: number;
  milestones: ProposalMilestone[];
  total_cost_min: number;
  total_cost_max: number;
  currency: string;
  payment_terms?: string;
  valid_until?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'negotiating';
  generated_at: string;
  updated_at: string;
}

export interface ProposalSection {
  title: string;
  description: string;
  cost_estimate?: number;
}

export interface ProposalMilestone {
  name: string;
  description: string;
  duration_weeks: number;
  deliverables: string[];
  payment_percentage: number;
}

export interface GenerateProposalParams {
  lead_id: string;
  services: string[];
  budget_range?: { min: number; max: number; currency: string };
  custom_notes?: string;
}
