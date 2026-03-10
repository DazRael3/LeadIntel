begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- Platform API keys (workspace-scoped, shown once, stored hashed)
create table if not exists api.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  name text not null,
  prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}'::text[],
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users(id),
  last_used_at timestamptz null,
  last_used_ip text null,
  last_used_user_agent text null,
  unique (workspace_id, prefix)
);

alter table api.api_keys enable row level security;

create index if not exists api_keys_workspace_created_idx on api.api_keys (workspace_id, created_at desc);
create index if not exists api_keys_workspace_last_used_idx on api.api_keys (workspace_id, last_used_at desc);

drop policy if exists api_keys_select_admin on api.api_keys;
create policy api_keys_select_admin
on api.api_keys for select
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists api_keys_insert_admin on api.api_keys;
create policy api_keys_insert_admin
on api.api_keys for insert
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']) and created_by = auth.uid());

drop policy if exists api_keys_update_admin on api.api_keys;
create policy api_keys_update_admin
on api.api_keys for update
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']))
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists api_keys_delete_admin on api.api_keys;
create policy api_keys_delete_admin
on api.api_keys for delete
using (api.has_workspace_role(workspace_id, array['owner','admin']));

-- Platform API request logs (sanitized; no bodies)
create table if not exists api.api_request_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  api_key_id uuid null references api.api_keys(id) on delete set null,
  method text not null,
  route text not null,
  status int not null,
  error_code text null,
  request_id text null,
  latency_ms int null,
  created_at timestamptz not null default now()
);

alter table api.api_request_logs enable row level security;

create index if not exists api_request_logs_workspace_created_idx on api.api_request_logs (workspace_id, created_at desc);
create index if not exists api_request_logs_key_created_idx on api.api_request_logs (api_key_id, created_at desc);

drop policy if exists api_request_logs_select_admin on api.api_request_logs;
create policy api_request_logs_select_admin
on api.api_request_logs for select
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

-- Inserts are performed by server-side platform API (service role). Do not allow via RLS.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='api_request_logs' and policyname='api_request_logs_no_insert') then
    create policy api_request_logs_no_insert on api.api_request_logs
    for insert to authenticated with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='api_request_logs' and policyname='api_request_logs_no_update') then
    create policy api_request_logs_no_update on api.api_request_logs
    for update to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='api_request_logs' and policyname='api_request_logs_no_delete') then
    create policy api_request_logs_no_delete on api.api_request_logs
    for delete to authenticated using (false);
  end if;
end $$;

notify pgrst, 'reload schema';
commit;

