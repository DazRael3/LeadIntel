-- 0022_activation_tracking_fields.sql
-- Adds minimal, non-sensitive activation markers to api.user_settings.
-- Safe to re-run (idempotent).

begin;

alter table api.user_settings
  add column if not exists pricing_viewed_at timestamptz,
  add column if not exists trust_viewed_at timestamptz,
  add column if not exists scoring_viewed_at timestamptz,
  add column if not exists templates_viewed_at timestamptz;

notify pgrst, 'reload schema';

commit;

