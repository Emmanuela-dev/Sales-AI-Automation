export interface WebsiteAnalysis {
  id: string;
  business_id: string;
  url: string;
  score: number; // 0–100
  has_https: boolean;
  is_mobile_responsive: boolean;
  page_speed_score?: number;
  has_booking_form: boolean;
  has_contact_form: boolean;
  has_seo_meta: boolean;
  has_large_images: boolean;
  has_analytics: boolean;
  has_live_chat: boolean;
  tech_stack?: string[];
  issues: WebsiteIssue[];
  recommendations: string[];
  screenshot_url?: string;
  analyzed_at: string;
}

export interface WebsiteIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export interface CompanyResearch {
  id: string;
  business_id: string;
  summary: string;
  industry: string;
  employee_range: string;
  estimated_revenue?: string;
  likely_needs: string[];
  estimated_budget_min?: number;
  estimated_budget_max?: number;
  currency: string;
  pain_points: string[];
  recent_signals?: string[];
  generated_at: string;
}
