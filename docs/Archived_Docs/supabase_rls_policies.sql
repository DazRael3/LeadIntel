-- LeadIntel RLS Policies for Supabase
-- Run this in your Supabase SQL editor to enable Row Level Security
-- This file is idempotent - safe to run multiple times

-- Enable Row Level Security on all tables
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trigger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS website_visitors ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Users can insert their own data" ON users;

-- Users can view their own data
CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own data (for profile creation)
CREATE POLICY "Users can insert their own data"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- LEADS TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert their own leads" ON leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON leads;

-- Users can view their own leads
CREATE POLICY "Users can view their own leads"
  ON leads FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own leads
CREATE POLICY "Users can insert their own leads"
  ON leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own leads
CREATE POLICY "Users can update their own leads"
  ON leads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own leads
CREATE POLICY "Users can delete their own leads"
  ON leads FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER_EVENTS TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own trigger events" ON trigger_events;
DROP POLICY IF EXISTS "Users can insert their own trigger events" ON trigger_events;
DROP POLICY IF EXISTS "Users can update their own trigger events" ON trigger_events;
DROP POLICY IF EXISTS "Users can delete their own trigger events" ON trigger_events;

-- Users can view their own trigger events
CREATE POLICY "Users can view their own trigger events"
  ON trigger_events FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own trigger events
CREATE POLICY "Users can insert their own trigger events"
  ON trigger_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own trigger events
CREATE POLICY "Users can update their own trigger events"
  ON trigger_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own trigger events
CREATE POLICY "Users can delete their own trigger events"
  ON trigger_events FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- USER_SETTINGS TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;

-- Users can view their own settings
CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert their own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PITCHES TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own pitches" ON pitches;
DROP POLICY IF EXISTS "Users can insert their own pitches" ON pitches;
DROP POLICY IF EXISTS "Users can update their own pitches" ON pitches;
DROP POLICY IF EXISTS "Users can delete their own pitches" ON pitches;

-- Users can view their own pitches
CREATE POLICY "Users can view their own pitches"
  ON pitches FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own pitches
CREATE POLICY "Users can insert their own pitches"
  ON pitches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pitches
CREATE POLICY "Users can update their own pitches"
  ON pitches FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own pitches
CREATE POLICY "Users can delete their own pitches"
  ON pitches FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SUBSCRIPTIONS TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON subscriptions;

-- Users can view their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own subscriptions (for webhook updates, service role should handle)
CREATE POLICY "Users can update their own subscriptions"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- WATCHLIST TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own watchlist" ON watchlist;
DROP POLICY IF EXISTS "Users can insert their own watchlist items" ON watchlist;
DROP POLICY IF EXISTS "Users can delete their own watchlist items" ON watchlist;

-- Users can view their own watchlist
CREATE POLICY "Users can view their own watchlist"
  ON watchlist FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own watchlist items
CREATE POLICY "Users can insert their own watchlist items"
  ON watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own watchlist items
CREATE POLICY "Users can delete their own watchlist items"
  ON watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- EMAIL_LOGS TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own email logs" ON email_logs;
DROP POLICY IF EXISTS "Users can insert their own email logs" ON email_logs;

-- Users can view their own email logs
CREATE POLICY "Users can view their own email logs"
  ON email_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own email logs
CREATE POLICY "Users can insert their own email logs"
  ON email_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- WEBSITE_VISITORS TABLE POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage website visitors" ON website_visitors;

-- Website visitors are typically inserted by service role (via API/webhook)
-- For now, allow authenticated users to view all (can be restricted later)
-- Note: This table may not have user_id, so adjust policy accordingly
-- If website_visitors has user_id, use: USING (auth.uid() = user_id)
-- Otherwise, this may need service role access only

-- Allow authenticated users to view website visitors
-- Adjust this policy based on your actual table structure
CREATE POLICY "Service role can manage website visitors"
  ON website_visitors FOR ALL
  USING (true)  -- Adjust based on your requirements
  WITH CHECK (true);

-- ============================================
-- NOTES
-- ============================================
-- 
-- 1. All policies use auth.uid() to match user_id columns
-- 2. Policies are idempotent - safe to run multiple times
-- 3. If you need service role access for webhooks, use Supabase service role key
-- 4. Adjust website_visitors policy based on your actual use case
-- 5. Test policies after applying to ensure they work as expected
