BEGIN;

-- LeadIntel: subscription fields required for Stripe webhook + trial UI
-- Safe to re-run (IF NOT EXISTS).

ALTER TABLE api.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Helpful indexes for common lookups.
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx ON api.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx ON api.subscriptions(user_id, status);

COMMIT;

