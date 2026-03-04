-- 0030_lifecycle_lazy_cron.sql
-- Support "lazy cron" by tracking per-user lifecycle evaluation.

begin;

alter table api.lifecycle_state
  add column if not exists last_checked_at timestamptz null;

notify pgrst, 'reload schema';

commit;

