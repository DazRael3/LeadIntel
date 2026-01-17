-- LeadIntel Public Schema Migration
-- Run this in Supabase SQL Editor to ensure tables exist in public schema
-- This migration ensures all tables are in the 'public' schema which is the standard for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  credits_remaining INTEGER DEFAULT 1,
  last_credit_reset TIMESTAMPTZ,
  last_unlock_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
-- TRIGGER_EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.trigger_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_domain TEXT,
  company_url TEXT,
  headline TEXT,
  event_type TEXT CHECK (event_type IN ('funding', 'new_hires', 'expansion', 'product_launch', 'partnership')),
  event_description TEXT,
  source_url TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER_SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  what_you_sell TEXT NOT NULL,
  ideal_customer TEXT NOT NULL,
  target_industries TEXT[],
  sender_name TEXT,
  sender_email TEXT,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_domain ON public.leads(company_domain);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON public.leads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_user_company_unique ON public.leads(user_id, company_domain);

CREATE INDEX IF NOT EXISTS idx_trigger_events_user_id ON public.trigger_events(user_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_lead_id ON public.trigger_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_trigger_events_company_domain ON public.trigger_events(company_domain);
CREATE INDEX IF NOT EXISTS idx_trigger_events_detected_at ON public.trigger_events(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- ============================================
-- UPDATE UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON public.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at 
  BEFORE UPDATE ON public.leads
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at 
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at 
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trigger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can insert their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view their own trigger events" ON public.trigger_events;
DROP POLICY IF EXISTS "Users can insert their own trigger events" ON public.trigger_events;
DROP POLICY IF EXISTS "Users can update their own trigger events" ON public.trigger_events;
DROP POLICY IF EXISTS "Users can delete their own trigger events" ON public.trigger_events;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;

-- RLS Policies for public.users
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- RLS Policies for public.leads
CREATE POLICY "Users can view their own leads" ON public.leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leads" ON public.leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads" ON public.leads
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads" ON public.leads
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for public.trigger_events
CREATE POLICY "Users can view their own trigger events" ON public.trigger_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trigger events" ON public.trigger_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trigger events" ON public.trigger_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trigger events" ON public.trigger_events
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for public.subscriptions
CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for public.user_settings
CREATE POLICY "Users can view their own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trigger_events TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;

-- Grant sequence permissions for UUID generation
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- NOTES
-- ============================================
-- 
-- 1. All tables are created in the 'public' schema (standard for Supabase)
-- 2. RLS policies ensure users can only access their own data
-- 3. Foreign key constraints maintain referential integrity
-- 4. Unique constraint on (user_id, company_domain) prevents duplicate leads
-- 5. Indexes optimize common query patterns
-- 6. Auto-update triggers keep updated_at current
-- 
-- IMPORTANT: Ensure PostgREST is configured to expose 'public' schema
-- In Supabase Dashboard: Settings > API > Exposed schemas should include 'public'
-- 
-- To verify tables exist:
--   SELECT table_schema, table_name 
--   FROM information_schema.tables 
--   WHERE table_schema = 'public' AND table_name IN ('users', 'leads', 'trigger_events', 'subscriptions', 'user_settings');
-- 
-- To test RLS:
--   SET ROLE authenticated;
--   SET request.jwt.claim.sub = 'user-uuid-here';
--   SELECT * FROM public.leads;
