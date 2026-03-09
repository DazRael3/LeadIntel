begin;

set local search_path = public, extensions, api;

create table if not exists api.custom_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  name text not null,
  description text null,
  destination_type text not null check (destination_type in ('webhook')),
  endpoint_id uuid not null references api.webhook_endpoints(id) on delete cascade,
  payload_template jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_custom_actions_updated_at') then
    create trigger trg_custom_actions_updated_at
    before update on api.custom_actions
    for each row execute function api.set_updated_at();
  end if;
end $$;

create index if not exists custom_actions_workspace_idx on api.custom_actions (workspace_id, created_at desc);

alter table api.custom_actions enable row level security;

drop policy if exists custom_actions_select on api.custom_actions;
create policy custom_actions_select
on api.custom_actions
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists custom_actions_insert_admin on api.custom_actions;
create policy custom_actions_insert_admin
on api.custom_actions
for insert
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']) and created_by = auth.uid());

drop policy if exists custom_actions_update_admin on api.custom_actions;
create policy custom_actions_update_admin
on api.custom_actions
for update
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']))
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists custom_actions_delete_admin on api.custom_actions;
create policy custom_actions_delete_admin
on api.custom_actions
for delete
using (api.has_workspace_role(workspace_id, array['owner','admin']));

notify pgrst, 'reload schema';
commit;

