begin;

set local search_path = public, extensions, api;

-- --------------------------------------------
-- In-app "Why-now digest" delivery via notifications
-- - Uses existing api.notifications table (created in 0050_team_collaboration_governance.sql)
-- - Adds an event_type index + optional JSON schema hint fields
-- - Idempotent and safe to re-run.
-- --------------------------------------------

do $$
begin
  -- If notifications table doesn't exist yet, skip (older envs).
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'api'
      and table_name = 'notifications'
  ) then
    create index if not exists notifications_to_user_event_created_idx
      on api.notifications (to_user_id, event_type, created_at desc);
  end if;
exception when undefined_table then
  -- ignore
end $$;

notify pgrst, 'reload schema';
commit;

