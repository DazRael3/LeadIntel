begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- ------------------------------------------------------------
-- CRM object mappings (explicit, workspace-scoped)
-- ------------------------------------------------------------
create table if not exists api.crm_object_mappings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  account_id uuid null references api.leads(id) on delete set null,
  mapping_kind text not null check (mapping_kind in ('account','opportunity')),
  crm_system text not null default 'generic',
  crm_object_id text not null,
  status text not null default 'mapped' check (status in ('mapped','ambiguous','stale','unmapped')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','ambiguous','not_linked','needs_review')),
  reason text null,
  meta jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint crm_object_mappings_object_id_len check (char_length(crm_object_id) > 0 and char_length(crm_object_id) <= 128),
  constraint crm_object_mappings_system_len check (char_length(crm_system) > 0 and char_length(crm_system) <= 32)
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_crm_object_mappings_updated_at') then
    create trigger trg_crm_object_mappings_updated_at
    before update on api.crm_object_mappings
    for each row execute function api.set_updated_at();
  end if;
exception when undefined_function then
  null;
end $$;

create index if not exists crm_object_mappings_workspace_kind_idx
  on api.crm_object_mappings (workspace_id, mapping_kind, created_at desc);
create index if not exists crm_object_mappings_workspace_account_idx
  on api.crm_object_mappings (workspace_id, account_id, mapping_kind, created_at desc);
create index if not exists crm_object_mappings_workspace_verification_idx
  on api.crm_object_mappings (workspace_id, verification_status, updated_at desc);

-- Avoid duplicate "account mapping" per system; allow multiple opportunity mappings per account.
create unique index if not exists crm_object_mappings_unique_account_map
  on api.crm_object_mappings (workspace_id, account_id, crm_system, mapping_kind)
  where mapping_kind = 'account';

create unique index if not exists crm_object_mappings_unique_opportunity_id
  on api.crm_object_mappings (workspace_id, crm_system, crm_object_id, mapping_kind)
  where mapping_kind = 'opportunity';

alter table api.crm_object_mappings enable row level security;

drop policy if exists crm_object_mappings_select on api.crm_object_mappings;
create policy crm_object_mappings_select on api.crm_object_mappings
for select using (api.is_workspace_member(workspace_id));

drop policy if exists crm_object_mappings_insert_member on api.crm_object_mappings;
create policy crm_object_mappings_insert_member on api.crm_object_mappings
for insert to authenticated
with check (api.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists crm_object_mappings_update_own_or_admin on api.crm_object_mappings;
create policy crm_object_mappings_update_own_or_admin on api.crm_object_mappings
for update to authenticated
using (
  api.is_workspace_member(workspace_id)
  and (
    created_by = auth.uid()
    or api.has_workspace_role(workspace_id, array['owner','admin','manager'])
  )
)
with check (
  api.is_workspace_member(workspace_id)
  and (
    created_by = auth.uid()
    or api.has_workspace_role(workspace_id, array['owner','admin','manager'])
  )
);

drop policy if exists crm_object_mappings_delete_admin_only on api.crm_object_mappings;
create policy crm_object_mappings_delete_admin_only on api.crm_object_mappings
for delete to authenticated
using (api.has_workspace_role(workspace_id, array['owner','admin']));

-- ------------------------------------------------------------
-- CRM opportunity observations (manual or webhook-derived)
-- ------------------------------------------------------------
create table if not exists api.crm_opportunity_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  account_id uuid null references api.leads(id) on delete set null,
  opportunity_mapping_id uuid null references api.crm_object_mappings(id) on delete set null,
  crm_system text not null default 'generic',
  opportunity_id text not null,
  stage text null,
  status text null,
  observed_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','webhook')),
  evidence_note text null,
  meta jsonb not null default '{}'::jsonb,
  recorded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint crm_opportunity_observations_opportunity_id_len check (char_length(opportunity_id) > 0 and char_length(opportunity_id) <= 128),
  constraint crm_opportunity_observations_system_len check (char_length(crm_system) > 0 and char_length(crm_system) <= 32),
  constraint crm_opportunity_observations_stage_len check (stage is null or char_length(stage) <= 64),
  constraint crm_opportunity_observations_status_len check (status is null or char_length(status) <= 64)
);

create index if not exists crm_opportunity_observations_workspace_observed_idx
  on api.crm_opportunity_observations (workspace_id, observed_at desc);
create index if not exists crm_opportunity_observations_workspace_opportunity_idx
  on api.crm_opportunity_observations (workspace_id, crm_system, opportunity_id, observed_at desc);
create index if not exists crm_opportunity_observations_workspace_account_idx
  on api.crm_opportunity_observations (workspace_id, account_id, observed_at desc);

alter table api.crm_opportunity_observations enable row level security;

drop policy if exists crm_opportunity_observations_select on api.crm_opportunity_observations;
create policy crm_opportunity_observations_select on api.crm_opportunity_observations
for select using (api.is_workspace_member(workspace_id));

drop policy if exists crm_opportunity_observations_insert_member on api.crm_opportunity_observations;
create policy crm_opportunity_observations_insert_member on api.crm_opportunity_observations
for insert to authenticated
with check (api.is_workspace_member(workspace_id) and recorded_by = auth.uid());

drop policy if exists crm_opportunity_observations_update_own_or_admin on api.crm_opportunity_observations;
create policy crm_opportunity_observations_update_own_or_admin on api.crm_opportunity_observations
for update to authenticated
using (
  api.is_workspace_member(workspace_id)
  and (
    recorded_by = auth.uid()
    or api.has_workspace_role(workspace_id, array['owner','admin','manager'])
  )
)
with check (
  api.is_workspace_member(workspace_id)
  and (
    recorded_by = auth.uid()
    or api.has_workspace_role(workspace_id, array['owner','admin','manager'])
  )
);

drop policy if exists crm_opportunity_observations_delete_admin_only on api.crm_opportunity_observations;
create policy crm_opportunity_observations_delete_admin_only on api.crm_opportunity_observations
for delete to authenticated
using (api.has_workspace_role(workspace_id, array['owner','admin']));

-- ------------------------------------------------------------
-- Verification reviews (auditable outcomes verification)
-- ------------------------------------------------------------
create table if not exists api.revenue_verification_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  target_type text not null check (target_type in ('crm_mapping','opportunity_observation','workflow_outcome_link')),
  target_id uuid not null,
  status text not null check (status in ('verified','ambiguous','not_linked','needs_review_later')),
  note text null,
  reviewed_by uuid not null references auth.users(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists revenue_verification_reviews_workspace_reviewed_idx
  on api.revenue_verification_reviews (workspace_id, reviewed_at desc);
create index if not exists revenue_verification_reviews_workspace_target_idx
  on api.revenue_verification_reviews (workspace_id, target_type, target_id, reviewed_at desc);
create index if not exists revenue_verification_reviews_workspace_status_idx
  on api.revenue_verification_reviews (workspace_id, status, reviewed_at desc);

alter table api.revenue_verification_reviews enable row level security;

drop policy if exists revenue_verification_reviews_select on api.revenue_verification_reviews;
create policy revenue_verification_reviews_select on api.revenue_verification_reviews
for select using (api.is_workspace_member(workspace_id));

drop policy if exists revenue_verification_reviews_write_admin_only on api.revenue_verification_reviews;
create policy revenue_verification_reviews_write_admin_only on api.revenue_verification_reviews
for insert to authenticated
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']) and reviewed_by = auth.uid());

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='revenue_verification_reviews' and policyname='revenue_verification_reviews_no_update') then
    create policy revenue_verification_reviews_no_update on api.revenue_verification_reviews
      for update to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='revenue_verification_reviews' and policyname='revenue_verification_reviews_no_delete') then
    create policy revenue_verification_reviews_no_delete on api.revenue_verification_reviews
      for delete to authenticated using (false);
  end if;
end $$;

grant usage on schema api to authenticated;
grant select, insert, update, delete on api.crm_object_mappings to authenticated;
grant select, insert, update, delete on api.crm_opportunity_observations to authenticated;
grant select, insert on api.revenue_verification_reviews to authenticated;

notify pgrst, 'reload schema';
commit;

