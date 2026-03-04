-- 0025_user_settings_tour_completed.sql
-- Adds a tour completion timestamp to api.user_settings (idempotent).

begin;

alter table api.user_settings
  add column if not exists tour_completed_at timestamptz;

-- Ensure PostgREST reloads schema after new column is added
notify pgrst, 'reload schema';

commit;

