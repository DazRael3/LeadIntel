begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- Workspace-level default destinations for handoffs (webhook-based in this wave).
alter table api.workspaces
  add column if not exists default_handoff_webhook_endpoint_id uuid null references api.webhook_endpoints(id) on delete set null;

-- Action recipes: guided workflow rules (not full automation).
create table if not exists api.action_recipes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  conditions jsonb not null default '{}'::jsonb,
  action_type text not null,
  destination_type text null,
  destination_id uuid null,
  is_enabled boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_action_recipes_updated_at') then
    create trigger trg_action_recipes_updated_at
    before update on api.action_recipes
    for each row execute function api.set_updated_at();
  end if;
end $$;

create index if not exists action_recipes_workspace_id_idx on api.action_recipes (workspace_id);
create index if not exists action_recipes_enabled_idx on api.action_recipes (workspace_id, is_enabled);

alter table api.action_recipes enable row level security;

-- Action queue: workspace-visible operational queue for handoffs and delivery tasks.
create table if not exists api.action_queue_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  lead_id uuid null references api.leads(id) on delete set null,
  action_type text not null,
  status text not null check (status in ('ready','queued','processing','delivered','failed','blocked','manual_review')) default 'ready',
  destination_type text null,
  destination_id uuid null,
  reason text null,
  payload_meta jsonb not null default '{}'::jsonb,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_action_queue_items_updated_at') then
    create trigger trg_action_queue_items_updated_at
    before update on api.action_queue_items
    for each row execute function api.set_updated_at();
  end if;
end $$;

create index if not exists action_queue_items_workspace_created_idx on api.action_queue_items (workspace_id, created_at desc);
create index if not exists action_queue_items_workspace_status_idx on api.action_queue_items (workspace_id, status, created_at desc);

alter table api.action_queue_items enable row level security;

-- Delivery history: correlates queue items with downstream delivery attempts (webhook/export).
create table if not exists api.action_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  queue_item_id uuid null references api.action_queue_items(id) on delete set null,
  actor_user_id uuid not null references auth.users(id),
  action_type text not null,
  destination_type text not null,
  destination_id uuid null,
  status text not null check (status in ('queued','processing','delivered','failed')) default 'queued',
  webhook_delivery_id uuid null references api.webhook_deliveries(id) on delete set null,
  export_job_id uuid null references api.export_jobs(id) on delete set null,
  error text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_action_deliveries_updated_at') then
    create trigger trg_action_deliveries_updated_at
    before update on api.action_deliveries
    for each row execute function api.set_updated_at();
  end if;
end $$;

create index if not exists action_deliveries_workspace_created_idx on api.action_deliveries (workspace_id, created_at desc);
create index if not exists action_deliveries_queue_item_idx on api.action_deliveries (queue_item_id);

alter table api.action_deliveries enable row level security;

-- RLS policies

-- action_recipes: members can read; only owner/admin can create/update/delete.
drop policy if exists action_recipes_select on api.action_recipes;
create policy action_recipes_select
on api.action_recipes
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists action_recipes_insert_admin_only on api.action_recipes;
create policy action_recipes_insert_admin_only
on api.action_recipes
for insert
with check (api.has_workspace_role(workspace_id, array['owner','admin']) and created_by = auth.uid());

drop policy if exists action_recipes_update_admin_only on api.action_recipes;
create policy action_recipes_update_admin_only
on api.action_recipes
for update
using (api.has_workspace_role(workspace_id, array['owner','admin']))
with check (api.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists action_recipes_delete_admin_only on api.action_recipes;
create policy action_recipes_delete_admin_only
on api.action_recipes
for delete
using (api.has_workspace_role(workspace_id, array['owner','admin']));

-- action_queue_items: members can read; members can insert; only owner/admin can update/delete (server typically updates via service role).
drop policy if exists action_queue_items_select on api.action_queue_items;
create policy action_queue_items_select
on api.action_queue_items
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists action_queue_items_insert_member on api.action_queue_items;
create policy action_queue_items_insert_member
on api.action_queue_items
for insert
with check (api.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists action_queue_items_update_admin_only on api.action_queue_items;
create policy action_queue_items_update_admin_only
on api.action_queue_items
for update
using (api.has_workspace_role(workspace_id, array['owner','admin']))
with check (api.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists action_queue_items_delete_admin_only on api.action_queue_items;
create policy action_queue_items_delete_admin_only
on api.action_queue_items
for delete
using (api.has_workspace_role(workspace_id, array['owner','admin']));

-- action_deliveries: members can read; inserts/updates server-side only (no authenticated access).
drop policy if exists action_deliveries_select on api.action_deliveries;
create policy action_deliveries_select
on api.action_deliveries
for select
using (api.is_workspace_member(workspace_id));

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='action_deliveries' and policyname='action_deliveries_no_write') then
    create policy "action_deliveries_no_write"
    on api.action_deliveries
    for all to authenticated
    using (false) with check (false);
  end if;
end $$;

notify pgrst, 'reload schema';
commit;

