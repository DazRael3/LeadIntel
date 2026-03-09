begin;

set local search_path = public, extensions, api;

create table if not exists api.workspace_policies (
  workspace_id uuid primary key references api.workspaces(id) on delete cascade,
  policy jsonb not null default '{}'::jsonb,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_workspace_policies_updated_at') then
    create trigger trg_workspace_policies_updated_at
    before update on api.workspace_policies
    for each row execute function api.set_updated_at();
  end if;
end $$;

alter table api.workspace_policies enable row level security;

drop policy if exists workspace_policies_select on api.workspace_policies;
create policy workspace_policies_select
on api.workspace_policies
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists workspace_policies_write_admin_only on api.workspace_policies;
create policy workspace_policies_write_admin_only
on api.workspace_policies
for insert
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists workspace_policies_update_admin_only on api.workspace_policies;
create policy workspace_policies_update_admin_only
on api.workspace_policies
for update
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']))
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='workspace_policies' and policyname='workspace_policies_no_delete') then
    create policy "workspace_policies_no_delete"
    on api.workspace_policies
    for delete to authenticated
    using (false);
  end if;
end $$;

notify pgrst, 'reload schema';
commit;

