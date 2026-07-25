-- ============================================================
-- ProspectAI — Initial Database Schema
-- Run against your Supabase project SQL editor or via migrate.ts
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- BUSINESSES
-- Core entity. Discovered via search or imported manually.
-- ============================================================
CREATE TABLE IF NOT EXISTS businesses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  industry        TEXT NOT NULL DEFAULT 'Other',
  country         TEXT NOT NULL DEFAULT '',
  city            TEXT NOT NULL DEFAULT '',
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  website         TEXT,
  google_rating   NUMERIC(3,1),
  google_reviews_count INTEGER DEFAULT 0,
  facebook_url    TEXT,
  linkedin_url    TEXT,
  twitter_url     TEXT,
  instagram_url   TEXT,
  description     TEXT,
  employee_range  TEXT,
  source          TEXT NOT NULL DEFAULT 'google_places'
                    CHECK (source IN ('google_places', 'manual', 'import')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate entries for the same business in the same city
CREATE UNIQUE INDEX IF NOT EXISTS businesses_name_city_idx
  ON businesses (LOWER(name), LOWER(city));

CREATE INDEX IF NOT EXISTS businesses_industry_idx ON businesses (industry);
CREATE INDEX IF NOT EXISTS businesses_city_idx ON businesses (city);
CREATE INDEX IF NOT EXISTS businesses_country_idx ON businesses (country);


-- ============================================================
-- LEADS
-- A business that has been saved by a user for follow-up.
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL DEFAULT 'system',
  status             TEXT NOT NULL DEFAULT 'discovered'
                       CHECK (status IN (
                         'discovered','analyzing','qualified','contacted',
                         'meeting','proposal','negotiation','won','lost'
                       )),
  opportunity_score  INTEGER CHECK (opportunity_score BETWEEN 0 AND 100),
  score_reasons      TEXT[],
  notes              TEXT,
  assigned_to        TEXT,
  tags               TEXT[],
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS leads_score_idx ON leads (opportunity_score DESC);
CREATE INDEX IF NOT EXISTS leads_business_idx ON leads (business_id);


-- ============================================================
-- WEBSITE ANALYSES
-- Results from Playwright website inspection
-- ============================================================
CREATE TABLE IF NOT EXISTS website_analyses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  url                  TEXT NOT NULL,
  score                INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  has_https            BOOLEAN NOT NULL DEFAULT false,
  is_mobile_responsive BOOLEAN NOT NULL DEFAULT false,
  page_speed_score     INTEGER,
  has_booking_form     BOOLEAN NOT NULL DEFAULT false,
  has_contact_form     BOOLEAN NOT NULL DEFAULT false,
  has_seo_meta         BOOLEAN NOT NULL DEFAULT false,
  has_large_images     BOOLEAN NOT NULL DEFAULT false,
  has_analytics        BOOLEAN NOT NULL DEFAULT false,
  has_live_chat        BOOLEAN NOT NULL DEFAULT false,
  tech_stack           TEXT[],
  issues               JSONB NOT NULL DEFAULT '[]',
  recommendations      TEXT[],
  screenshot_url       TEXT,
  analyzed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analyses_business_idx ON website_analyses (business_id);
CREATE INDEX IF NOT EXISTS analyses_score_idx ON website_analyses (score);


-- ============================================================
-- COMPANY RESEARCH
-- AI-generated research profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS company_research (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  summary               TEXT NOT NULL DEFAULT '',
  industry              TEXT,
  employee_range        TEXT,
  estimated_revenue     TEXT,
  likely_needs          TEXT[],
  estimated_budget_min  INTEGER,
  estimated_budget_max  INTEGER,
  currency              TEXT NOT NULL DEFAULT 'KES',
  pain_points           TEXT[],
  recent_signals        TEXT[],
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS research_business_idx ON company_research (business_id);


-- ============================================================
-- OUTREACH MESSAGES
-- AI-generated personalized sales messages
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach_messages (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                  UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channel                  TEXT NOT NULL
                             CHECK (channel IN ('email','whatsapp','linkedin','cold_call_script')),
  subject                  TEXT,
  body                     TEXT NOT NULL,
  personalization_context  TEXT,
  status                   TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','sent','opened','replied','bounced')),
  sent_at                  TIMESTAMPTZ,
  opened_at                TIMESTAMPTZ,
  replied_at               TIMESTAMPTZ,
  generated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outreach_lead_idx ON outreach_messages (lead_id);
CREATE INDEX IF NOT EXISTS outreach_status_idx ON outreach_messages (status);


-- ============================================================
-- PROPOSALS
-- AI-generated project proposals
-- ============================================================
CREATE TABLE IF NOT EXISTS proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  executive_summary TEXT NOT NULL,
  scope             JSONB NOT NULL DEFAULT '[]',
  deliverables      TEXT[],
  timeline_weeks    INTEGER NOT NULL DEFAULT 8,
  milestones        JSONB NOT NULL DEFAULT '[]',
  total_cost_min    INTEGER NOT NULL DEFAULT 0,
  total_cost_max    INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'KES',
  payment_terms     TEXT,
  valid_until       DATE,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','sent','accepted','rejected','negotiating')),
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proposals_lead_idx ON proposals (lead_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON proposals (status);


-- ============================================================
-- CRM ACTIVITIES
-- Log of all interactions with a lead
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL DEFAULT 'system',
  type          TEXT NOT NULL
                  CHECK (type IN ('note','call','email','meeting','stage_change','follow_up')),
  title         TEXT NOT NULL,
  description   TEXT,
  scheduled_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activities_lead_idx ON crm_activities (lead_id);
CREATE INDEX IF NOT EXISTS activities_type_idx ON crm_activities (type);


-- ============================================================
-- FOLLOW-UPS
-- AI-scheduled follow-up reminders
-- ============================================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL DEFAULT 'system',
  trigger_type        TEXT NOT NULL
                        CHECK (trigger_type IN (
                          'no_response','scheduled','meeting_reminder','proposal_expiring'
                        )),
  message_suggestion  TEXT NOT NULL,
  due_at              TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','sent','dismissed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS followups_lead_idx ON follow_ups (lead_id);
CREATE INDEX IF NOT EXISTS followups_status_due_idx ON follow_ups (status, due_at);


-- ============================================================
-- UPDATED_AT trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  CREATE TRIGGER set_updated_at_businesses
    BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER set_updated_at_leads
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER set_updated_at_proposals
    BEFORE UPDATE ON proposals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
