-- LeadIntel: Onboarding v2 persistence (safe to re-run)
-- Adds a minimal set of fields used to persist onboarding progress and workflow choice.
-- No behavioral changes to billing, gating, or RLS.

BEGIN;

ALTER TABLE api.user_settings
  ADD COLUMN IF NOT EXISTS onboarding_v2_step INTEGER,
  ADD COLUMN IF NOT EXISTS onboarding_workflow TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ;

COMMIT;

