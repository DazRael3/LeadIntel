begin;

set local search_path = public, extensions, api;

-- --------------------------------------------
-- Starter proof/sample mode + tour goals
-- --------------------------------------------

-- 1) Persist tour goals + sample-mode state in user_settings (per-user scope).
alter table api.user_settings
  add column if not exists tour_goal text null,
  add column if not exists tour_goal_selected_at timestamptz null,
  add column if not exists sample_mode_enabled boolean not null default false,
  add column if not exists sample_seeded_at timestamptz null,
  add column if not exists sample_seed_version int2 null,
  add column if not exists sample_checklist_state jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'api.user_settings'::regclass
      and conname = 'user_settings_tour_goal_check'
  ) then
    alter table api.user_settings
      add constraint user_settings_tour_goal_check
      check (tour_goal is null or tour_goal in ('pipeline','conversion','expansion'));
  end if;
exception when undefined_table then
  -- ignore
end $$;

create index if not exists user_settings_tour_goal_idx on api.user_settings (tour_goal);

-- 2) Mark sample/demo rows on core user-owned tables.
-- This keeps sample-mode reversible without leaking into normal workflows.
alter table api.leads
  add column if not exists is_sample boolean not null default false;
create index if not exists leads_user_is_sample_idx on api.leads (user_id, is_sample, created_at desc);

alter table api.pitches
  add column if not exists is_sample boolean not null default false;
create index if not exists pitches_user_is_sample_idx on api.pitches (user_id, is_sample, created_at desc);

alter table api.user_reports
  add column if not exists is_sample boolean not null default false;
create index if not exists user_reports_user_is_sample_idx on api.user_reports (user_id, is_sample, created_at desc);

alter table api.trigger_events
  add column if not exists is_sample boolean not null default false;
create index if not exists trigger_events_user_is_sample_idx on api.trigger_events (user_id, is_sample, detected_at desc);

notify pgrst, 'reload schema';
commit;

