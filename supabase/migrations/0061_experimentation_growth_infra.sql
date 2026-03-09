begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- ------------------------------------------------------------
-- Experiments (workspace-scoped definitions + rollout controls)
-- ------------------------------------------------------------
create table if not exists api.experiments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  key text not null,
  name text not null,
  hypothesis text null,
  surface text not null,
  status text not null default 'draft' check (status in ('draft','running','paused','completed','archived','rolled_out','reverted')),
  rollout_percent integer not null default 0 check (rollout_percent >= 0 and rollout_percent <= 100),
  unit_type text not null default 'user' check (unit_type in ('user','workspace','session')),
  targeting jsonb not null default '{}'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  primary_metrics text[] not null default '{}'::text[],
  secondary_metrics text[] not null default '{}'::text[],
  notes text null,
  kill_switch boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experiments_key_len check (char_length(key) > 0 and char_length(key) <= 64),
  constraint experiments_surface_len check (char_length(surface) > 0 and char_length(surface) <= 64)
);

create unique index if not exists experiments_workspace_key_uq
  on api.experiments (workspace_id, key);
create index if not exists experiments_workspace_status_idx
  on api.experiments (workspace_id, status, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_experiments_updated_at') then
    create trigger trg_experiments_updated_at
    before update on api.experiments
    for each row execute function api.set_updated_at();
  end if;
exception when undefined_function then
  -- Older deployments without api.set_updated_at(): skip trigger safely.
  null;
end $$;

alter table api.experiments enable row level security;

drop policy if exists experiments_select on api.experiments;
create policy experiments_select on api.experiments
for select using (api.is_workspace_member(workspace_id));

drop policy if exists experiments_write_admin_only on api.experiments;
create policy experiments_write_admin_only on api.experiments
for all to authenticated
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']))
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

-- ------------------------------------------------------------
-- Experiment exposures (workspace-scoped, deduped per unit)
-- ------------------------------------------------------------
create table if not exists api.experiment_exposures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  experiment_id uuid not null references api.experiments(id) on delete cascade,
  experiment_key text not null,
  variant_key text not null,
  unit_type text not null check (unit_type in ('user','workspace','session')),
  unit_id text not null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  surface text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint experiment_exposures_unit_id_len check (char_length(unit_id) > 0 and char_length(unit_id) <= 128),
  constraint experiment_exposures_experiment_key_len check (char_length(experiment_key) > 0 and char_length(experiment_key) <= 64),
  constraint experiment_exposures_surface_len check (char_length(surface) > 0 and char_length(surface) <= 64)
);

create unique index if not exists experiment_exposures_dedupe_uq
  on api.experiment_exposures (workspace_id, experiment_key, unit_type, unit_id);
create index if not exists experiment_exposures_workspace_created_idx
  on api.experiment_exposures (workspace_id, created_at desc);
create index if not exists experiment_exposures_experiment_variant_idx
  on api.experiment_exposures (experiment_id, variant_key, created_at desc);

alter table api.experiment_exposures enable row level security;

drop policy if exists experiment_exposures_select_admin_only on api.experiment_exposures;
create policy experiment_exposures_select_admin_only on api.experiment_exposures
for select to authenticated
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists experiment_exposures_insert_own on api.experiment_exposures;
create policy experiment_exposures_insert_own on api.experiment_exposures
for insert to authenticated
with check (
  api.is_workspace_member(workspace_id)
  and actor_user_id = auth.uid()
);

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='experiment_exposures' and policyname='experiment_exposures_no_update') then
    create policy experiment_exposures_no_update on api.experiment_exposures
      for update to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='experiment_exposures' and policyname='experiment_exposures_no_delete') then
    create policy experiment_exposures_no_delete on api.experiment_exposures
      for delete to authenticated using (false);
  end if;
end $$;

-- ------------------------------------------------------------
-- Growth events (workspace-scoped, queryable for ops)
-- ------------------------------------------------------------
create table if not exists api.growth_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  event_name text not null,
  event_props jsonb not null default '{}'::jsonb,
  dedupe_key text null,
  created_at timestamptz not null default now(),
  constraint growth_events_event_name_len check (char_length(event_name) > 0 and char_length(event_name) <= 64),
  constraint growth_events_dedupe_key_len check (dedupe_key is null or (char_length(dedupe_key) > 0 and char_length(dedupe_key) <= 128))
);

create index if not exists growth_events_workspace_created_idx
  on api.growth_events (workspace_id, created_at desc);
create index if not exists growth_events_workspace_event_idx
  on api.growth_events (workspace_id, event_name, created_at desc);
create unique index if not exists growth_events_dedupe_uq
  on api.growth_events (workspace_id, user_id, event_name, dedupe_key)
  where dedupe_key is not null;

alter table api.growth_events enable row level security;

drop policy if exists growth_events_select_admin_only on api.growth_events;
create policy growth_events_select_admin_only on api.growth_events
for select to authenticated
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists growth_events_insert_own on api.growth_events;
create policy growth_events_insert_own on api.growth_events
for insert to authenticated
with check (
  api.is_workspace_member(workspace_id)
  and user_id = auth.uid()
);

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='growth_events' and policyname='growth_events_no_update') then
    create policy growth_events_no_update on api.growth_events
      for update to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='growth_events' and policyname='growth_events_no_delete') then
    create policy growth_events_no_delete on api.growth_events
      for delete to authenticated using (false);
  end if;
end $$;

-- Defensive privileges (RLS remains authoritative).
grant usage on schema api to authenticated;
grant select, insert, update, delete on api.experiments to authenticated;
grant select, insert on api.experiment_exposures to authenticated;
grant select, insert on api.growth_events to authenticated;

notify pgrst, 'reload schema';

commit;

