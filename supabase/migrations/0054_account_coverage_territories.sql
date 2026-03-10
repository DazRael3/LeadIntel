begin;

set local search_path = public, extensions, api;

-- Territory rules: bounded matching (no CRM territory sync claims).
create table if not exists api.territory_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  name text not null,
  territory_key text not null,
  priority int not null default 100,
  match_type text not null check (match_type in ('domain_suffix','domain_exact','tag')),
  match_value text not null,
  is_enabled boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_territory_rules_updated_at') then
    create trigger trg_territory_rules_updated_at
    before update on api.territory_rules
    for each row execute function api.set_updated_at();
  end if;
end $$;

create index if not exists territory_rules_workspace_priority_idx
  on api.territory_rules (workspace_id, is_enabled, priority asc, created_at desc);

alter table api.territory_rules enable row level security;

drop policy if exists territory_rules_select on api.territory_rules;
create policy territory_rules_select
on api.territory_rules
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists territory_rules_write on api.territory_rules;
create policy territory_rules_write
on api.territory_rules
for insert
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']) and created_by = auth.uid());

drop policy if exists territory_rules_update on api.territory_rules;
create policy territory_rules_update
on api.territory_rules
for update
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']))
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists territory_rules_delete on api.territory_rules;
create policy territory_rules_delete
on api.territory_rules
for delete
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

-- Account programs: strategic/named/expansion-watch flags for team coordination.
create table if not exists api.account_program_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  lead_id uuid null references api.leads(id) on delete set null,
  account_domain text null,
  account_name text null,
  program_state text not null check (program_state in ('strategic','named','expansion_watch','monitor','standard')) default 'standard',
  note text null,
  set_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, lead_id)
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_account_program_accounts_updated_at') then
    create trigger trg_account_program_accounts_updated_at
    before update on api.account_program_accounts
    for each row execute function api.set_updated_at();
  end if;
end $$;

create index if not exists account_program_accounts_workspace_state_idx
  on api.account_program_accounts (workspace_id, program_state, updated_at desc);

alter table api.account_program_accounts enable row level security;

drop policy if exists account_program_accounts_select on api.account_program_accounts;
create policy account_program_accounts_select
on api.account_program_accounts
for select
using (api.is_workspace_member(workspace_id));

-- Write policy is intentionally broader than admin-only; route handlers still enforce governance policies.
drop policy if exists account_program_accounts_write on api.account_program_accounts;
create policy account_program_accounts_write
on api.account_program_accounts
for insert
with check (api.is_workspace_member(workspace_id) and set_by = auth.uid());

drop policy if exists account_program_accounts_update on api.account_program_accounts;
create policy account_program_accounts_update
on api.account_program_accounts
for update
using (api.is_workspace_member(workspace_id) and set_by = auth.uid())
with check (api.is_workspace_member(workspace_id) and set_by = auth.uid());

drop policy if exists account_program_accounts_update_admin on api.account_program_accounts;
create policy account_program_accounts_update_admin
on api.account_program_accounts
for update
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']))
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

notify pgrst, 'reload schema';
commit;

