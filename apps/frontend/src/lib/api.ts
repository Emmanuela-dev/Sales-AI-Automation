import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Search ──────────────────────────────────────────────────────────────────

export const searchBusinesses = (params: {
  query: string;
  city?: string;
  country?: string;
  industry?: string;
  limit?: number;
}) => api.post('/search', params).then(r => r.data);

// ─── Businesses ──────────────────────────────────────────────────────────────

export const getBusinesses = (params?: Record<string, string>) =>
  api.get('/businesses', { params }).then(r => r.data);

export const getBusiness = (id: string) =>
  api.get(`/businesses/${id}`).then(r => r.data);

// ─── Leads ───────────────────────────────────────────────────────────────────

export const getLeads = (params?: Record<string, string>) =>
  api.get('/leads', { params }).then(r => r.data);

export const getLead = (id: string) =>
  api.get(`/leads/${id}`).then(r => r.data);

export const createLead = (data: { business_id: string; notes?: string; tags?: string[] }) =>
  api.post('/leads', data).then(r => r.data);

export const updateLead = (id: string, data: Record<string, unknown>) =>
  api.patch(`/leads/${id}`, data).then(r => r.data);

// ─── Analysis ────────────────────────────────────────────────────────────────

export const getAnalysis = (businessId: string) =>
  api.get(`/analysis/${businessId}`).then(r => r.data);

export const triggerAnalysis = (data: { business_id: string; url: string }) =>
  api.post('/analysis/trigger', data).then(r => r.data);

// ─── Outreach ────────────────────────────────────────────────────────────────

export const getOutreach = (leadId: string) =>
  api.get(`/outreach/lead/${leadId}`).then(r => r.data);

export const generateOutreach = (data: {
  lead_id: string;
  channels: string[];
  tone?: string;
  focus?: string;
}) => api.post('/outreach/generate', data).then(r => r.data);

export const updateOutreach = (id: string, data: Record<string, unknown>) =>
  api.patch(`/outreach/${id}`, data).then(r => r.data);

// ─── Proposals ───────────────────────────────────────────────────────────────

export const getProposals = (leadId: string) =>
  api.get(`/proposals/lead/${leadId}`).then(r => r.data);

export const generateProposal = (data: {
  lead_id: string;
  services: string[];
  budget_range?: { min: number; max: number; currency: string };
  custom_notes?: string;
}) => api.post('/proposals/generate', data).then(r => r.data);

export const updateProposal = (id: string, data: Record<string, unknown>) =>
  api.patch(`/proposals/${id}`, data).then(r => r.data);

// ─── CRM ─────────────────────────────────────────────────────────────────────

export const getActivities = (leadId: string) =>
  api.get(`/crm/activities/${leadId}`).then(r => r.data);

export const createActivity = (data: Record<string, unknown>) =>
  api.post('/crm/activities', data).then(r => r.data);

export const getFollowUps = () =>
  api.get('/crm/follow-ups').then(r => r.data);

export const updateFollowUp = (id: string, status: 'sent' | 'dismissed') =>
  api.patch(`/crm/follow-ups/${id}`, { status }).then(r => r.data);

export const getPipeline = () =>
  api.get('/crm/pipeline').then(r => r.data);

// ─── Analytics ───────────────────────────────────────────────────────────────

export const getDashboardStats = (period?: string) =>
  api.get('/analytics/dashboard', { params: { period } }).then(r => r.data);

export const getPipelineStats = () =>
  api.get('/analytics/pipeline').then(r => r.data);
