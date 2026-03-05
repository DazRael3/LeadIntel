begin;

-- Webhooks are workspace-scoped and admin-governed.
-- Secrets are stored server-side and never returned after creation by the API.

create table if not exists api.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default '{}'::text[],
  is_enabled boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  last_success_at timestamptz null,
  last_error_at timestamptz null,
  failure_count int not null default 0
);

alter table api.webhook_endpoints enable row level security;

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'webhook_endpoints_workspace_id_idx') then
    create index webhook_endpoints_workspace_id_idx on api.webhook_endpoints (workspace_id);
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'webhook_endpoints_enabled_idx') then
    create index webhook_endpoints_enabled_idx on api.webhook_endpoints (workspace_id, is_enabled);
  end if;
end $$;

create table if not exists api.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references api.webhook_endpoints(id) on delete cascade,
  event_type text not null,
  event_id uuid not null,
  payload jsonb not null,
  status text not null check (status in ('pending','sent','failed')) default 'pending',
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_status int null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table api.webhook_deliveries enable row level security;

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'webhook_deliveries_endpoint_id_created_at_idx') then
    create index webhook_deliveries_endpoint_id_created_at_idx on api.webhook_deliveries (endpoint_id, created_at desc);
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'webhook_deliveries_due_idx') then
    create index webhook_deliveries_due_idx on api.webhook_deliveries (status, next_attempt_at);
  end if;
end $$;

-- Updated timestamp maintenance
create or replace function api.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_webhook_deliveries_updated_at on api.webhook_deliveries;
create trigger set_webhook_deliveries_updated_at
before update on api.webhook_deliveries
for each row
execute procedure api.set_updated_at();

-- RLS policies

-- webhook_endpoints: workspace members can read endpoints; only owner/admin can create/update.
drop policy if exists webhook_endpoints_select on api.webhook_endpoints;
create policy webhook_endpoints_select
on api.webhook_endpoints
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists webhook_endpoints_insert_admin_only on api.webhook_endpoints;
create policy webhook_endpoints_insert_admin_only
on api.webhook_endpoints
for insert
with check (api.has_workspace_role(workspace_id, array['owner','admin']) and created_by = auth.uid());

drop policy if exists webhook_endpoints_update_admin_only on api.webhook_endpoints;
create policy webhook_endpoints_update_admin_only
on api.webhook_endpoints
for update
using (api.has_workspace_role(workspace_id, array['owner','admin']))
with check (api.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists webhook_endpoints_delete_admin_only on api.webhook_endpoints;
create policy webhook_endpoints_delete_admin_only
on api.webhook_endpoints
for delete
using (api.has_workspace_role(workspace_id, array['owner','admin']));

-- webhook_deliveries: members can read delivery summaries for endpoints in their workspace.
-- Inserts/updates happen server-side (service role) and are not permitted via RLS.
drop policy if exists webhook_deliveries_select on api.webhook_deliveries;
create policy webhook_deliveries_select
on api.webhook_deliveries
for select
using (
  exists (
    select 1
    from api.webhook_endpoints e
    where e.id = endpoint_id
      and api.is_workspace_member(e.workspace_id)
  )
);

notify pgrst, 'reload schema';
commit;

