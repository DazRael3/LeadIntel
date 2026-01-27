begin;

-- 0018_app_trial_fields.sql
-- Adds app-level trial metadata columns to api.users (idempotent).

alter table api.users
  add column if not exists trial_starts_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

-- Optional index to efficiently query active/expired trials.
create index if not exists users_trial_ends_at_idx on api.users (trial_ends_at);

-- Ensure PostgREST reloads schema after trial fields are added
NOTIFY pgrst, 'reload schema';

commit;

