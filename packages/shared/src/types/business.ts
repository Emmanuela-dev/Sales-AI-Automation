export interface Business {
  id: string;
  name: string;
  industry: string;
  country: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  google_rating?: number;
  google_reviews_count?: number;
  facebook_url?: string;
  linkedin_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  description?: string;
  employee_range?: string;
  source: 'google_places' | 'manual' | 'import';
  created_at: string;
  updated_at: string;
}

export interface BusinessSearchParams {
  query: string;
  city?: string;
  country?: string;
  industry?: string;
  limit?: number;
  offset?: number;
}

export interface BusinessSearchResult {
  businesses: Business[];
  total: number;
  query_summary: string;
}
