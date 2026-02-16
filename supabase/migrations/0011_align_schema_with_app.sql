-- LeadIntel: Align api schema with application code expectations
-- Adds missing columns that the app queries for
-- Safe to re-run (uses IF NOT EXISTS)

BEGIN;

-- ============================================
-- api.users: Add subscription and credit columns
-- ============================================
ALTER TABLE api.users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_credit_reset TIMESTAMPTZ;

-- Add check constraint for subscription_tier if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'api.users'::regclass
      AND conname = 'users_subscription_tier_check'
  ) THEN
    ALTER TABLE api.users
      ADD CONSTRAINT users_subscription_tier_check
      CHECK (subscription_tier IN ('free', 'pro'));
  END IF;
END $$;

-- ============================================
-- api.user_settings: Add onboarding column
-- ============================================
ALTER TABLE api.user_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- ============================================
-- api.trigger_events: Add columns for event details
-- The existing table has (id, user_id, lead_id, event_type, payload, created_at)
-- App expects: company_name, event_description, source_url, detected_at, company_url, company_domain, headline
-- ============================================
ALTER TABLE api.trigger_events
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS company_domain TEXT,
  ADD COLUMN IF NOT EXISTS company_url TEXT,
  ADD COLUMN IF NOT EXISTS event_description TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ DEFAULT NOW();

-- Create index on detected_at for ordering queries
CREATE INDEX IF NOT EXISTS trigger_events_detected_at_idx ON api.trigger_events(detected_at DESC);

-- ============================================
-- Grants: Ensure authenticated users have access
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON api.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.trigger_events TO authenticated;

COMMIT;
