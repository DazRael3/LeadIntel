begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- 1) Persisted current workspace selection (per-user)
alter table api.users
  add column if not exists current_workspace_id uuid null references api.workspaces(id) on delete set null;

create index if not exists users_current_workspace_id_idx on api.users (current_workspace_id);

-- 2) Membership source (direct vs delegated)
alter table api.workspace_members
  add column if not exists membership_source text not null default 'direct';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'api.workspace_members'::regclass
      and conname = 'workspace_members_source_check'
  ) then
    alter table api.workspace_members
      add constraint workspace_members_source_check check (membership_source in ('direct','delegated'));
  end if;
exception when undefined_table then
  -- ignore
end $$;

-- 3) Delegated access grants (explicit, auditable, revocable)
create table if not exists api.delegated_access_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  grantee_user_id uuid not null references auth.users(id) on delete cascade,
  granted_role text not null check (granted_role in ('admin','manager','rep','viewer')),
  scopes jsonb not null default '{}'::jsonb,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users(id),
  note text null,
  unique (workspace_id, grantee_user_id)
);

alter table api.delegated_access_grants enable row level security;

create index if not exists delegated_access_grants_workspace_idx on api.delegated_access_grants (workspace_id, granted_at desc);

drop policy if exists delegated_access_grants_select_privileged on api.delegated_access_grants;
create policy delegated_access_grants_select_privileged
on api.delegated_access_grants
for select using (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists delegated_access_grants_insert_privileged on api.delegated_access_grants;
create policy delegated_access_grants_insert_privileged
on api.delegated_access_grants
for insert with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']) and granted_by = auth.uid());

drop policy if exists delegated_access_grants_update_privileged on api.delegated_access_grants;
create policy delegated_access_grants_update_privileged
on api.delegated_access_grants
for update using (api.has_workspace_role(workspace_id, array['owner','admin','manager']))
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists delegated_access_grants_delete_privileged on api.delegated_access_grants;
create policy delegated_access_grants_delete_privileged
on api.delegated_access_grants
for delete using (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

-- 4) Rollout jobs + items (template distribution via copy semantics)
create table if not exists api.rollout_jobs (
  id uuid primary key default gen_random_uuid(),
  source_workspace_id uuid not null references api.workspaces(id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  status text not null default 'created' check (status in ('created','processing','completed','failed')),
  meta jsonb not null default '{}'::jsonb
);

alter table api.rollout_jobs enable row level security;
create index if not exists rollout_jobs_source_idx on api.rollout_jobs (source_workspace_id, created_at desc);

drop policy if exists rollout_jobs_select_privileged on api.rollout_jobs;
create policy rollout_jobs_select_privileged
on api.rollout_jobs for select
using (api.has_workspace_role(source_workspace_id, array['owner','admin','manager']));

drop policy if exists rollout_jobs_insert_privileged on api.rollout_jobs;
create policy rollout_jobs_insert_privileged
on api.rollout_jobs for insert
with check (api.has_workspace_role(source_workspace_id, array['owner','admin','manager']) and created_by = auth.uid());

drop policy if exists rollout_jobs_update_privileged on api.rollout_jobs;
create policy rollout_jobs_update_privileged
on api.rollout_jobs for update
using (api.has_workspace_role(source_workspace_id, array['owner','admin','manager']))
with check (api.has_workspace_role(source_workspace_id, array['owner','admin','manager']));

create table if not exists api.rollout_items (
  id uuid primary key default gen_random_uuid(),
  rollout_job_id uuid not null references api.rollout_jobs(id) on delete cascade,
  source_template_id uuid not null references api.templates(id) on delete cascade,
  target_workspace_id uuid not null references api.workspaces(id) on delete cascade,
  target_template_id uuid null references api.templates(id) on delete set null,
  status text not null default 'created' check (status in ('created','applied','skipped','failed')),
  error_sanitized text null,
  applied_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table api.rollout_items enable row level security;
create index if not exists rollout_items_job_idx on api.rollout_items (rollout_job_id, created_at desc);
create index if not exists rollout_items_target_ws_idx on api.rollout_items (target_workspace_id, created_at desc);

drop policy if exists rollout_items_select_privileged on api.rollout_items;
create policy rollout_items_select_privileged
on api.rollout_items for select
using (
  exists (
    select 1 from api.rollout_jobs j
    where j.id = rollout_job_id
      and api.has_workspace_role(j.source_workspace_id, array['owner','admin','manager'])
  )
);

drop policy if exists rollout_items_insert_privileged on api.rollout_items;
create policy rollout_items_insert_privileged
on api.rollout_items for insert
with check (
  exists (
    select 1 from api.rollout_jobs j
    where j.id = rollout_job_id
      and api.has_workspace_role(j.source_workspace_id, array['owner','admin','manager'])
  )
);

drop policy if exists rollout_items_update_privileged on api.rollout_items;
create policy rollout_items_update_privileged
on api.rollout_items for update
using (
  exists (
    select 1 from api.rollout_jobs j
    where j.id = rollout_job_id
      and api.has_workspace_role(j.source_workspace_id, array['owner','admin','manager'])
  )
)
with check (
  exists (
    select 1 from api.rollout_jobs j
    where j.id = rollout_job_id
      and api.has_workspace_role(j.source_workspace_id, array['owner','admin','manager'])
  )
);

-- 5) Workspace presentation (bounded; not white-label)
alter table api.workspaces
  add column if not exists client_label text null,
  add column if not exists reference_tags text[] not null default '{}'::text[];

notify pgrst, 'reload schema';
commit;

