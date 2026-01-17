-- LeadIntel API Schema Tables
-- Run this in your Supabase SQL editor to create the api schema and tables
-- This ensures tables exist in the 'api' schema that PostgREST exposes

-- Create api schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS api;

-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- API.LEADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS api.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_url TEXT NOT NULL,
  company_domain TEXT,
  company_name TEXT NOT NULL,
  ai_personalized_pitch TEXT NOT NULL,
  trigger_event TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_domain)
);

-- ============================================
-- API.TRIGGER_EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS api.trigger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES api.leads(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_domain TEXT,
  headline TEXT,
  event_type TEXT CHECK (event_type IN ('funding', 'new_hires', 'expansion', 'product_launch', 'partnership')),
  event_description TEXT,
  source_url TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_api_leads_user_id ON api.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_api_leads_company_domain ON api.leads(company_domain);
CREATE INDEX IF NOT EXISTS idx_api_leads_updated_at ON api.leads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_leads_user_company_unique ON api.leads(user_id, company_domain);

CREATE INDEX IF NOT EXISTS idx_api_trigger_events_user_id ON api.trigger_events(user_id);
CREATE INDEX IF NOT EXISTS idx_api_trigger_events_lead_id ON api.trigger_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_api_trigger_events_company_domain ON api.trigger_events(company_domain);
CREATE INDEX IF NOT EXISTS idx_api_trigger_events_detected_at ON api.trigger_events(detected_at DESC);

-- ============================================
-- UPDATE UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION api.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on api.leads
DROP TRIGGER IF EXISTS update_api_leads_updated_at ON api.leads;
CREATE TRIGGER update_api_leads_updated_at 
  BEFORE UPDATE ON api.leads
  FOR EACH ROW 
  EXECUTE FUNCTION api.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE api.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.trigger_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own leads" ON api.leads;
DROP POLICY IF EXISTS "Users can insert their own leads" ON api.leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON api.leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON api.leads;

DROP POLICY IF EXISTS "Users can view their own trigger events" ON api.trigger_events;
DROP POLICY IF EXISTS "Users can insert their own trigger events" ON api.trigger_events;
DROP POLICY IF EXISTS "Users can update their own trigger events" ON api.trigger_events;
DROP POLICY IF EXISTS "Users can delete their own trigger events" ON api.trigger_events;

-- RLS Policies for api.leads
CREATE POLICY "Users can view their own leads" ON api.leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leads" ON api.leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads" ON api.leads
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads" ON api.leads
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for api.trigger_events
CREATE POLICY "Users can view their own trigger events" ON api.trigger_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trigger events" ON api.trigger_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trigger events" ON api.trigger_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trigger events" ON api.trigger_events
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- NOTES
-- ============================================
-- 
-- 1. Tables are created in the 'api' schema which PostgREST exposes
-- 2. RLS policies ensure users can only access their own data
-- 3. Foreign key constraints maintain referential integrity
-- 4. Unique constraint on (user_id, company_domain) prevents duplicate leads
-- 5. Indexes optimize common query patterns
-- 6. Auto-update trigger keeps updated_at current
-- 
-- To verify tables exist:
--   SELECT table_schema, table_name 
--   FROM information_schema.tables 
--   WHERE table_schema = 'api';
-- 
-- To test RLS:
--   SET ROLE authenticated;
--   SET request.jwt.claim.sub = 'user-uuid-here';
--   SELECT * FROM api.leads;
