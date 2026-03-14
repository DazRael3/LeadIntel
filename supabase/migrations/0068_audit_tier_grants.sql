begin;

set local search_path = public, extensions, api;

-- Audit tier grants: explicit, revocable temporary tier elevation for evaluators/auditors.
-- This is intentionally separate from billing and Stripe subscriptions.
create table if not exists api.audit_tier_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  grantee_user_id uuid not null references auth.users(id) on delete cascade,
  granted_tier text not null check (granted_tier in ('closer','closer_plus','team')),
  previous_subscription_tier text null,
  expires_at timestamptz null,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users(id),
  note text null,
  unique (workspace_id, grantee_user_id)
);

alter table api.audit_tier_grants enable row level security;
create index if not exists audit_tier_grants_workspace_idx on api.audit_tier_grants (workspace_id, granted_at desc);

drop policy if exists audit_tier_grants_select_privileged on api.audit_tier_grants;
create policy audit_tier_grants_select_privileged
on api.audit_tier_grants
for select using (api.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists audit_tier_grants_insert_privileged on api.audit_tier_grants;
create policy audit_tier_grants_insert_privileged
on api.audit_tier_grants
for insert with check (api.has_workspace_role(workspace_id, array['owner','admin']) and granted_by = auth.uid());

drop policy if exists audit_tier_grants_update_privileged on api.audit_tier_grants;
create policy audit_tier_grants_update_privileged
on api.audit_tier_grants
for update using (api.has_workspace_role(workspace_id, array['owner','admin']))
with check (api.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists audit_tier_grants_delete_privileged on api.audit_tier_grants;
create policy audit_tier_grants_delete_privileged
on api.audit_tier_grants
for delete using (api.has_workspace_role(workspace_id, array['owner','admin']));

notify pgrst, 'reload schema';
commit;

