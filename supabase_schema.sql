-- Minimal schema for leads and trigger_events tables
-- Run this in your Supabase SQL editor if tables don't exist

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_url TEXT,
  company_domain TEXT,
  company_name TEXT NOT NULL,
  ai_personalized_pitch TEXT NOT NULL,
  trigger_event TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_domain)
);

-- Migration: Add company_domain column and unique constraint if table exists but column doesn't
DO $$ 
BEGIN
  -- Add company_domain column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'company_domain'
  ) THEN
    ALTER TABLE leads ADD COLUMN company_domain TEXT;
  END IF;

  -- Add unique constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_user_id_company_domain_key'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_user_id_company_domain_key UNIQUE (user_id, company_domain);
  END IF;
END $$;

-- Trigger events table
CREATE TABLE IF NOT EXISTS trigger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_domain TEXT,
  event_type TEXT CHECK (event_type IN ('funding', 'new_hires', 'expansion', 'product_launch', 'partnership')),
  event_description TEXT,
  headline TEXT,
  source_url TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_url ON leads(company_url);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON leads(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trigger_events_user_id ON trigger_events(user_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_company_domain ON trigger_events(company_domain);
CREATE INDEX IF NOT EXISTS idx_trigger_events_lead_id ON trigger_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_detected_at ON trigger_events(detected_at DESC);

-- Update updated_at timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own leads and trigger events
CREATE POLICY "Users can view their own leads" ON leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leads" ON leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads" ON leads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own trigger events" ON trigger_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trigger events" ON trigger_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
