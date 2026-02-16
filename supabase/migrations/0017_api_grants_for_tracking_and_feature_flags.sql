-- 0015_api_grants_for_tracking_and_feature_flags.sql
-- Ensure authenticated role has explicit privileges on newer api tables.
-- RLS continues to enforce tenant isolation; these GRANTs only remove "permission denied" footguns.
--
-- Safe to re-run.

BEGIN;

-- Schema usage (defensive; 0001 already grants this)
GRANT USAGE ON SCHEMA api TO authenticated;

-- Tenant-scoped tables that app routes use with the authenticated role.
GRANT SELECT, INSERT, UPDATE, DELETE ON api.website_visitors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.watchlist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.email_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.feature_flags TO authenticated;

-- NOTE: We intentionally do NOT grant access to api.stripe_webhook_events for authenticated users.
-- That table remains service-role-only and/or locked down by policy.

COMMIT;

