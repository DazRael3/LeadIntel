-- 0024_user_settings_phone.sql
-- Adds an optional phone number field to api.user_settings (idempotent).

begin;

alter table api.user_settings
  add column if not exists phone text;

-- Ensure PostgREST reloads schema after new column is added
notify pgrst, 'reload schema';

commit;

