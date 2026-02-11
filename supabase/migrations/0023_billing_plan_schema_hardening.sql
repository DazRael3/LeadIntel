-- 0023_billing_plan_schema_hardening.sql
-- LeadIntel: Billing/plan schema hardening for Starter/Closer resolution
--
-- Goal:
-- - Ensure the `api` schema contains the columns used by the app for plan resolution:
--   - api.users.subscription_tier (internal marker: 'free' | 'pro')
--   - api.subscriptions.status, stripe_price_id, price_id, trial_end, created_at
-- - Ensure roles have USAGE on schema api and table privileges to avoid "permission denied for schema api".
--
-- Safe to re-run (idempotent).

BEGIN;

-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS api;

-- Schema usage grants (service role must always be able to access api.*)
GRANT USAGE ON SCHEMA api TO anon, authenticated, service_role;

-- =========================
-- api.users
-- =========================
ALTER TABLE api.users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free';

-- Backfill any NULLs defensively (if column existed without NOT NULL)
UPDATE api.users
SET subscription_tier = 'free'
WHERE subscription_tier IS NULL;

-- Constrain to known internal markers (free/pro) if missing.
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

-- Ensure authenticated can read their own row (policy may already exist from 0001)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'users'
      AND policyname = 'users_select_own'
  ) THEN
    CREATE POLICY "users_select_own"
    ON api.users FOR SELECT
    TO authenticated
    USING (id = auth.uid());
  END IF;
END $$;

-- =========================
-- api.subscriptions
-- =========================
ALTER TABLE api.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

-- Ensure authenticated can read their own subscriptions (policy may already exist from 0001)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'subscriptions'
      AND policyname = 'subscriptions_select_own'
  ) THEN
    CREATE POLICY "subscriptions_select_own"
    ON api.subscriptions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Helpful index for plan resolution lookups
CREATE INDEX IF NOT EXISTS subscriptions_user_created_at_idx
  ON api.subscriptions(user_id, created_at DESC);

-- =========================
-- Table privileges
-- =========================
GRANT SELECT, INSERT, UPDATE, DELETE ON api.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.subscriptions TO authenticated;

-- Service role: explicit privileges to prevent schema permission issues in locked-down setups.
GRANT SELECT, INSERT, UPDATE, DELETE ON api.users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.subscriptions TO service_role;

COMMIT;

