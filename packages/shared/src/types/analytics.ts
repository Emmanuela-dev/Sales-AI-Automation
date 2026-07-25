export interface DashboardStats {
  businesses_found: number;
  high_value_prospects: number;
  emails_sent: number;
  meetings_booked: number;
  clients_won: number;
  revenue_total: number;
  currency: string;
  period: 'week' | 'month' | 'quarter' | 'year' | 'all';
}

export interface PipelineStats {
  stage: string;
  count: number;
  value_estimate: number;
}

export interface ConversionMetrics {
  discovery_to_qualified: number;
  qualified_to_contacted: number;
  contacted_to_meeting: number;
  meeting_to_proposal: number;
  proposal_to_won: number;
}
