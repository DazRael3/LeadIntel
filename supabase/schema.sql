-- LeadIntel Database Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  stripe_customer_id TEXT,
  credits_remaining INTEGER DEFAULT 1,
  last_credit_reset TIMESTAMPTZ,
  last_unlock_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger Events table
CREATE TABLE IF NOT EXISTS trigger_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('funding', 'new_hires', 'expansion', 'product_launch', 'partnership')),
  event_description TEXT NOT NULL,
  source_url TEXT NOT NULL,
  company_url TEXT,
  detected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pitches table
CREATE TABLE IF NOT EXISTS pitches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_url TEXT NOT NULL,
  company_name TEXT NOT NULL,
  pitch_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads table (AI-generated leads with pitches)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  contact_email TEXT,
  prospect_email TEXT,
  prospect_linkedin TEXT,
  ai_personalized_pitch TEXT NOT NULL,
  fit_score INTEGER DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  growth_potential INTEGER DEFAULT 0 CHECK (growth_potential >= 0 AND growth_potential <= 100),
  enterprise_stability INTEGER DEFAULT 0 CHECK (enterprise_stability >= 0 AND enterprise_stability <= 100),
  funding_amount NUMERIC,
  industry TEXT,
  years_in_business INTEGER,
  tech_stack_count INTEGER,
  recent_hiring_count INTEGER,
  growth_signals JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watchlist table (users can star leads for monitoring)
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  watched_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lead_id)
);

-- Subscriptions table (track payment status)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Website Visitors table (Intent Tracker)
CREATE TABLE IF NOT EXISTS website_visitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  referer TEXT,
  company_name TEXT,
  company_domain TEXT,
  company_industry TEXT,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Settings table (stores onboarding data)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Email Logs table (tracks sent emails)
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
  resend_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_trigger_events_detected_at ON trigger_events(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_events_event_type ON trigger_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pitches_user_id ON pitches(user_id);
CREATE INDEX IF NOT EXISTS idx_pitches_created_at ON pitches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_company_name ON leads(company_name);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_website_visitors_visited_at ON website_visitors(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_visitors_company_name ON website_visitors(company_name);
CREATE INDEX IF NOT EXISTS idx_leads_fit_score ON leads(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_growth_potential ON leads(growth_potential DESC);
CREATE INDEX IF NOT EXISTS idx_leads_enterprise_stability ON leads(enterprise_stability DESC);
CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_lead_id ON watchlist(lead_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_expires_at ON watchlist(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Trigger events policies (public read, service role write)
CREATE POLICY "Anyone can view trigger events"
  ON trigger_events FOR SELECT
  USING (true);

-- Pitches policies
CREATE POLICY "Users can view their own pitches"
  ON pitches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pitches"
  ON pitches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Leads policies (public read, service role write)
CREATE POLICY "Anyone can view leads"
  ON leads FOR SELECT
  USING (true);

-- Subscriptions policies
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Website Visitors policies (users can view all visitors)
CREATE POLICY "Users can view website visitors"
  ON website_visitors FOR SELECT
  USING (true);

-- User Settings policies
CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Email Logs policies
CREATE POLICY "Users can view their own email logs"
  ON email_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email logs"
  ON email_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Watchlist policies
CREATE POLICY "Users can view their own watchlist"
  ON watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own watchlist"
  ON watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own watchlist"
  ON watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, subscription_tier)
  VALUES (
    NEW.id,
    NEW.email,
    'free'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new auth user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();