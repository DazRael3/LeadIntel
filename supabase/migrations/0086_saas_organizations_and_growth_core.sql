begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- =========================================================
-- LeadIntel SaaS core multi-tenant schema (organization-scoped)
-- =========================================================
-- This migration is intentionally additive/idempotent so existing
-- app flows remain operational while enabling organization scoping
-- for growth automation features.

-- -----------------------------
-- organizations
-- -----------------------------
create table if not exists api.organizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references api.workspaces(id) on delete set null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  slug text null,
  status text not null default 'active' check (status in ('active', 'trialing', 'suspended', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id),
  unique (slug)
);

create index if not exists organizations_owner_user_id_idx on api.organizations (owner_user_id);
create index if not exists organizations_created_at_idx on api.organizations (created_at desc);
create index if not exists organizations_name_search_idx
  on api.organizations using gin (to_tsvector('simple', coalesce(name, '')));

alter table api.organizations enable row level security;

-- -----------------------------
-- profiles (auth user -> organization membership)
-- -----------------------------
create table if not exists api.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_id uuid not null references api.organizations(id) on delete restrict,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  full_name text null,
  title text null,
  timezone text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_organization_id_idx on api.profiles (organization_id);
create index if not exists profiles_user_id_idx on api.profiles (user_id);
create index if not exists profiles_created_at_idx on api.profiles (created_at desc);
create index if not exists profiles_full_name_search_idx
  on api.profiles using gin (to_tsvector('simple', coalesce(full_name, '')));

alter table api.profiles enable row level security;

-- -----------------------------
-- Organization membership helpers (security definer to avoid RLS recursion)
-- -----------------------------
create or replace function api.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = api, public
as $$
  select p.organization_id
  from api.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;

create or replace function api.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = api, public
as $$
  select exists(
    select 1
    from api.profiles p
    where p.user_id = auth.uid()
      and p.organization_id = p_organization_id
  )
$$;

create or replace function api.has_organization_role(p_organization_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = api, public
as $$
  select exists(
    select 1
    from api.profiles p
    where p.user_id = auth.uid()
      and p.organization_id = p_organization_id
      and p.role = any(p_roles)
  )
$$;

revoke all on function api.current_user_organization_id() from public;
revoke all on function api.is_organization_member(uuid) from public;
revoke all on function api.has_organization_role(uuid, text[]) from public;
grant execute on function api.current_user_organization_id() to authenticated, service_role;
grant execute on function api.is_organization_member(uuid) to authenticated, service_role;
grant execute on function api.has_organization_role(uuid, text[]) to authenticated, service_role;

-- -----------------------------
-- Required existing tables: add organization scoping + metering
-- -----------------------------
alter table api.leads
  add column if not exists organization_id uuid null references api.organizations(id) on delete set null;

alter table api.subscriptions
  add column if not exists organization_id uuid null references api.organizations(id) on delete set null;

alter table api.usage_events
  add column if not exists organization_id uuid null references api.organizations(id) on delete set null,
  add column if not exists feature_key text null,
  add column if not exists units integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'api.usage_events'::regclass
      and conname = 'usage_events_units_positive_check'
  ) then
    alter table api.usage_events
      add constraint usage_events_units_positive_check check (units > 0);
  end if;
exception when undefined_table then
  null;
end $$;

alter table api.audit_logs
  add column if not exists organization_id uuid null references api.organizations(id) on delete set null;

create index if not exists leads_organization_id_idx on api.leads (organization_id);
create index if not exists leads_organization_created_at_idx on api.leads (organization_id, created_at desc);
create index if not exists leads_search_idx
  on api.leads using gin (
    to_tsvector(
      'simple',
      coalesce(company_name, '') || ' ' || coalesce(company_domain, '')
    )
  );

create index if not exists subscriptions_organization_id_idx on api.subscriptions (organization_id);
create index if not exists subscriptions_organization_created_at_idx on api.subscriptions (organization_id, created_at desc);

create index if not exists usage_events_organization_id_idx on api.usage_events (organization_id);
create index if not exists usage_events_org_feature_created_at_idx
  on api.usage_events (organization_id, feature_key, created_at desc);
create index if not exists usage_events_created_at_idx on api.usage_events (created_at desc);

create index if not exists audit_logs_organization_id_idx on api.audit_logs (organization_id);
create index if not exists audit_logs_organization_created_at_idx on api.audit_logs (organization_id, created_at desc);

-- -----------------------------
-- lead_enrichment
-- -----------------------------
create table if not exists api.lead_enrichment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references api.organizations(id) on delete cascade,
  lead_id uuid not null references api.leads(id) on delete cascade,
  provider text not null,
  enrichment_status text not null default 'pending' check (enrichment_status in ('pending', 'complete', 'failed')),
  confidence numeric(5,4) null check (confidence >= 0 and confidence <= 1),
  payload jsonb not null default '{}'::jsonb,
  enriched_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_enrichment_org_idx on api.lead_enrichment (organization_id);
create index if not exists lead_enrichment_lead_id_idx on api.lead_enrichment (lead_id);
create index if not exists lead_enrichment_created_at_idx on api.lead_enrichment (created_at desc);
create index if not exists lead_enrichment_provider_idx on api.lead_enrichment (provider);

alter table api.lead_enrichment enable row level security;

-- -----------------------------
-- lead_scores
-- -----------------------------
create table if not exists api.lead_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references api.organizations(id) on delete cascade,
  lead_id uuid not null references api.leads(id) on delete cascade,
  model_version text not null,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  grade text null,
  factors jsonb not null default '{}'::jsonb,
  scored_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_scores_org_idx on api.lead_scores (organization_id);
create index if not exists lead_scores_lead_id_idx on api.lead_scores (lead_id);
create index if not exists lead_scores_created_at_idx on api.lead_scores (created_at desc);
create index if not exists lead_scores_score_idx on api.lead_scores (score desc);

alter table api.lead_scores enable row level security;

-- -----------------------------
-- campaigns
-- -----------------------------
create table if not exists api.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references api.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null,
  description text null,
  channel text not null default 'email' check (channel in ('email', 'linkedin', 'multichannel')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived')),
  objective text null,
  audience_filter jsonb not null default '{}'::jsonb,
  schedule_start timestamptz null,
  schedule_end timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_org_idx on api.campaigns (organization_id);
create index if not exists campaigns_created_by_idx on api.campaigns (created_by);
create index if not exists campaigns_created_at_idx on api.campaigns (created_at desc);
create index if not exists campaigns_name_search_idx
  on api.campaigns using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')));

alter table api.campaigns enable row level security;

-- -----------------------------
-- campaign_leads
-- -----------------------------
create table if not exists api.campaign_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references api.organizations(id) on delete cascade,
  campaign_id uuid not null references api.campaigns(id) on delete cascade,
  lead_id uuid not null references api.leads(id) on delete cascade,
  stage text not null default 'queued' check (stage in ('queued', 'pending_approval', 'approved', 'sent', 'replied', 'failed')),
  personalized_copy text null,
  metadata jsonb not null default '{}'::jsonb,
  last_contacted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

create index if not exists campaign_leads_org_idx on api.campaign_leads (organization_id);
create index if not exists campaign_leads_campaign_idx on api.campaign_leads (campaign_id);
create index if not exists campaign_leads_lead_idx on api.campaign_leads (lead_id);
create index if not exists campaign_leads_created_at_idx on api.campaign_leads (created_at desc);

alter table api.campaign_leads enable row level security;

-- -----------------------------
-- ai_generations
-- -----------------------------
create table if not exists api.ai_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references api.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  lead_id uuid null references api.leads(id) on delete set null,
  campaign_id uuid null references api.campaigns(id) on delete set null,
  generation_type text not null check (generation_type in ('lead_summary', 'lead_outreach', 'campaign_sequence', 'enrichment_summary', 'other')),
  model text null,
  prompt_hash text null,
  status text not null default 'queued' check (status in ('queued', 'succeeded', 'failed')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  cost_usd numeric(12,6) null,
  content jsonb not null default '{}'::jsonb,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_generations_org_idx on api.ai_generations (organization_id);
create index if not exists ai_generations_user_id_idx on api.ai_generations (user_id);
create index if not exists ai_generations_created_at_idx on api.ai_generations (created_at desc);
create index if not exists ai_generations_type_created_at_idx on api.ai_generations (generation_type, created_at desc);

alter table api.ai_generations enable row level security;

-- -----------------------------
-- saved_searches
-- -----------------------------
create table if not exists api.saved_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references api.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  query jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  last_run_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_searches_org_idx on api.saved_searches (organization_id);
create index if not exists saved_searches_user_id_idx on api.saved_searches (user_id);
create index if not exists saved_searches_created_at_idx on api.saved_searches (created_at desc);
create index if not exists saved_searches_name_search_idx
  on api.saved_searches using gin (to_tsvector('simple', coalesce(name, '')));
create index if not exists saved_searches_query_gin_idx on api.saved_searches using gin (query);

alter table api.saved_searches enable row level security;

-- -----------------------------
-- updated_at triggers where appropriate
-- -----------------------------
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_organizations_updated_at') then
    create trigger trg_organizations_updated_at
    before update on api.organizations
    for each row execute function api.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_profiles_updated_at') then
    create trigger trg_profiles_updated_at
    before update on api.profiles
    for each row execute function api.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_lead_enrichment_updated_at') then
    create trigger trg_lead_enrichment_updated_at
    before update on api.lead_enrichment
    for each row execute function api.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_lead_scores_updated_at') then
    create trigger trg_lead_scores_updated_at
    before update on api.lead_scores
    for each row execute function api.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_campaigns_updated_at') then
    create trigger trg_campaigns_updated_at
    before update on api.campaigns
    for each row execute function api.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_campaign_leads_updated_at') then
    create trigger trg_campaign_leads_updated_at
    before update on api.campaign_leads
    for each row execute function api.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_ai_generations_updated_at') then
    create trigger trg_ai_generations_updated_at
    before update on api.ai_generations
    for each row execute function api.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_saved_searches_updated_at') then
    create trigger trg_saved_searches_updated_at
    before update on api.saved_searches
    for each row execute function api.set_updated_at();
  end if;
exception when undefined_function then
  -- Defensive fallback for environments missing api.set_updated_at()
  null;
end $$;

-- -----------------------------
-- Backfill organizations/profiles from existing workspace model
-- -----------------------------
insert into api.organizations (workspace_id, owner_user_id, name, slug, metadata)
select
  w.id,
  w.owner_user_id,
  w.name,
  null,
  jsonb_build_object('source', 'workspace_backfill')
from api.workspaces w
on conflict (workspace_id) do nothing;

-- Fallback organization per owner (for users without workspace-mapped org)
insert into api.organizations (owner_user_id, name, metadata)
select
  u.id,
  coalesce(nullif(split_part(u.email, '@', 1), ''), 'LeadIntel User') || ' Organization',
  jsonb_build_object('source', 'owner_backfill')
from auth.users u
where not exists (
  select 1
  from api.organizations o
  where o.owner_user_id = u.id
)
on conflict do nothing;

-- Profile backfill from workspace membership (preferred)
insert into api.profiles (user_id, organization_id, role, full_name)
select distinct on (wm.user_id)
  wm.user_id,
  o.id as organization_id,
  case wm.role
    when 'owner' then 'owner'
    when 'admin' then 'admin'
    else 'member'
  end as role,
  coalesce(
    nullif((u.raw_user_meta_data ->> 'full_name'), ''),
    nullif((u.raw_user_meta_data ->> 'name'), '')
  ) as full_name
from api.workspace_members wm
join api.organizations o
  on o.workspace_id = wm.workspace_id
left join auth.users u
  on u.id = wm.user_id
where wm.user_id is not null
order by
  wm.user_id,
  case wm.role
    when 'owner' then 1
    when 'admin' then 2
    else 3
  end,
  wm.created_at
on conflict (user_id) do nothing;

-- Profile fallback to owner organization for remaining users
insert into api.profiles (user_id, organization_id, role, full_name)
select
  u.id as user_id,
  o.id as organization_id,
  case when o.owner_user_id = u.id then 'owner' else 'member' end as role,
  coalesce(
    nullif((u.raw_user_meta_data ->> 'full_name'), ''),
    nullif((u.raw_user_meta_data ->> 'name'), '')
  ) as full_name
from auth.users u
join api.organizations o
  on o.owner_user_id = u.id
where not exists (
  select 1 from api.profiles p where p.user_id = u.id
)
on conflict (user_id) do nothing;

-- Existing-table organization_id backfill
update api.leads l
set organization_id = p.organization_id
from api.profiles p
where l.organization_id is null
  and p.user_id = l.user_id;

update api.subscriptions s
set organization_id = p.organization_id
from api.profiles p
where s.organization_id is null
  and p.user_id = s.user_id;

update api.usage_events ue
set organization_id = p.organization_id
from api.profiles p
where ue.organization_id is null
  and p.user_id = ue.user_id;

update api.audit_logs al
set organization_id = o.id
from api.organizations o
where al.organization_id is null
  and o.workspace_id = al.workspace_id;

-- -----------------------------
-- RLS policies: organizations + profiles
-- -----------------------------
drop policy if exists organizations_select_member on api.organizations;
create policy organizations_select_member
on api.organizations
for select
using (api.is_organization_member(id) or owner_user_id = auth.uid());

drop policy if exists organizations_insert_owner on api.organizations;
create policy organizations_insert_owner
on api.organizations
for insert
with check (owner_user_id = auth.uid());

drop policy if exists organizations_update_admin on api.organizations;
create policy organizations_update_admin
on api.organizations
for update
using (api.has_organization_role(id, array['owner', 'admin']))
with check (api.has_organization_role(id, array['owner', 'admin']));

drop policy if exists organizations_delete_owner on api.organizations;
create policy organizations_delete_owner
on api.organizations
for delete
using (api.has_organization_role(id, array['owner']));

drop policy if exists profiles_select_org on api.profiles;
create policy profiles_select_org
on api.profiles
for select
using (user_id = auth.uid() or api.is_organization_member(organization_id));

drop policy if exists profiles_insert_org on api.profiles;
create policy profiles_insert_org
on api.profiles
for insert
with check (
  user_id = auth.uid()
  or api.has_organization_role(organization_id, array['owner', 'admin'])
);

drop policy if exists profiles_update_org on api.profiles;
create policy profiles_update_org
on api.profiles
for update
using (
  user_id = auth.uid()
  or api.has_organization_role(organization_id, array['owner', 'admin'])
)
with check (
  user_id = auth.uid()
  or api.has_organization_role(organization_id, array['owner', 'admin'])
);

drop policy if exists profiles_delete_admin on api.profiles;
create policy profiles_delete_admin
on api.profiles
for delete
using (api.has_organization_role(organization_id, array['owner', 'admin']));

-- -----------------------------
-- RLS policies: new growth tables
-- -----------------------------
drop policy if exists lead_enrichment_select_org on api.lead_enrichment;
create policy lead_enrichment_select_org
on api.lead_enrichment
for select
using (api.is_organization_member(organization_id));

drop policy if exists lead_enrichment_insert_org on api.lead_enrichment;
create policy lead_enrichment_insert_org
on api.lead_enrichment
for insert
with check (
  api.has_organization_role(organization_id, array['owner', 'admin', 'member'])
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists lead_enrichment_update_org on api.lead_enrichment;
create policy lead_enrichment_update_org
on api.lead_enrichment
for update
using (api.has_organization_role(organization_id, array['owner', 'admin', 'member']))
with check (api.has_organization_role(organization_id, array['owner', 'admin', 'member']));

drop policy if exists lead_enrichment_delete_admin on api.lead_enrichment;
create policy lead_enrichment_delete_admin
on api.lead_enrichment
for delete
using (api.has_organization_role(organization_id, array['owner', 'admin']));

drop policy if exists lead_scores_select_org on api.lead_scores;
create policy lead_scores_select_org
on api.lead_scores
for select
using (api.is_organization_member(organization_id));

drop policy if exists lead_scores_insert_org on api.lead_scores;
create policy lead_scores_insert_org
on api.lead_scores
for insert
with check (
  api.has_organization_role(organization_id, array['owner', 'admin', 'member'])
  and (scored_by_user_id is null or scored_by_user_id = auth.uid())
);

drop policy if exists lead_scores_update_org on api.lead_scores;
create policy lead_scores_update_org
on api.lead_scores
for update
using (api.has_organization_role(organization_id, array['owner', 'admin', 'member']))
with check (api.has_organization_role(organization_id, array['owner', 'admin', 'member']));

drop policy if exists lead_scores_delete_admin on api.lead_scores;
create policy lead_scores_delete_admin
on api.lead_scores
for delete
using (api.has_organization_role(organization_id, array['owner', 'admin']));

drop policy if exists campaigns_select_org on api.campaigns;
create policy campaigns_select_org
on api.campaigns
for select
using (api.is_organization_member(organization_id));

drop policy if exists campaigns_insert_org on api.campaigns;
create policy campaigns_insert_org
on api.campaigns
for insert
with check (
  api.has_organization_role(organization_id, array['owner', 'admin', 'member'])
  and created_by = auth.uid()
);

drop policy if exists campaigns_update_org on api.campaigns;
create policy campaigns_update_org
on api.campaigns
for update
using (api.has_organization_role(organization_id, array['owner', 'admin', 'member']))
with check (api.has_organization_role(organization_id, array['owner', 'admin', 'member']));

drop policy if exists campaigns_delete_admin on api.campaigns;
create policy campaigns_delete_admin
on api.campaigns
for delete
using (api.has_organization_role(organization_id, array['owner', 'admin']));

drop policy if exists campaign_leads_select_org on api.campaign_leads;
create policy campaign_leads_select_org
on api.campaign_leads
for select
using (api.is_organization_member(organization_id));

drop policy if exists campaign_leads_insert_org on api.campaign_leads;
create policy campaign_leads_insert_org
on api.campaign_leads
for insert
with check (api.has_organization_role(organization_id, array['owner', 'admin', 'member']));

drop policy if exists campaign_leads_update_org on api.campaign_leads;
create policy campaign_leads_update_org
on api.campaign_leads
for update
using (api.has_organization_role(organization_id, array['owner', 'admin', 'member']))
with check (api.has_organization_role(organization_id, array['owner', 'admin', 'member']));

drop policy if exists campaign_leads_delete_admin on api.campaign_leads;
create policy campaign_leads_delete_admin
on api.campaign_leads
for delete
using (api.has_organization_role(organization_id, array['owner', 'admin']));

drop policy if exists ai_generations_select_org on api.ai_generations;
create policy ai_generations_select_org
on api.ai_generations
for select
using (api.is_organization_member(organization_id));

drop policy if exists ai_generations_insert_org on api.ai_generations;
create policy ai_generations_insert_org
on api.ai_generations
for insert
with check (
  api.has_organization_role(organization_id, array['owner', 'admin', 'member'])
  and user_id = auth.uid()
);

drop policy if exists ai_generations_update_org on api.ai_generations;
create policy ai_generations_update_org
on api.ai_generations
for update
using (api.has_organization_role(organization_id, array['owner', 'admin', 'member']))
with check (api.has_organization_role(organization_id, array['owner', 'admin', 'member']));

drop policy if exists ai_generations_delete_admin on api.ai_generations;
create policy ai_generations_delete_admin
on api.ai_generations
for delete
using (api.has_organization_role(organization_id, array['owner', 'admin']));

drop policy if exists saved_searches_select_org on api.saved_searches;
create policy saved_searches_select_org
on api.saved_searches
for select
using (
  api.is_organization_member(organization_id)
  and (is_shared or user_id = auth.uid() or api.has_organization_role(organization_id, array['owner', 'admin']))
);

drop policy if exists saved_searches_insert_org on api.saved_searches;
create policy saved_searches_insert_org
on api.saved_searches
for insert
with check (
  api.has_organization_role(organization_id, array['owner', 'admin', 'member'])
  and user_id = auth.uid()
);

drop policy if exists saved_searches_update_org on api.saved_searches;
create policy saved_searches_update_org
on api.saved_searches
for update
using (
  user_id = auth.uid()
  or api.has_organization_role(organization_id, array['owner', 'admin'])
)
with check (
  user_id = auth.uid()
  or api.has_organization_role(organization_id, array['owner', 'admin'])
);

drop policy if exists saved_searches_delete_org on api.saved_searches;
create policy saved_searches_delete_org
on api.saved_searches
for delete
using (
  user_id = auth.uid()
  or api.has_organization_role(organization_id, array['owner', 'admin'])
);

-- -----------------------------
-- RLS augmentation for required existing tables
-- -----------------------------
alter table api.leads enable row level security;
alter table api.subscriptions enable row level security;
alter table api.usage_events enable row level security;
alter table api.audit_logs enable row level security;

drop policy if exists leads_select_organization on api.leads;
create policy leads_select_organization
on api.leads
for select
using (
  (organization_id is not null and api.is_organization_member(organization_id))
  or user_id = auth.uid()
);

drop policy if exists leads_insert_organization on api.leads;
create policy leads_insert_organization
on api.leads
for insert
with check (
  user_id = auth.uid()
  and (
    organization_id is null
    or api.is_organization_member(organization_id)
  )
);

drop policy if exists leads_update_organization on api.leads;
create policy leads_update_organization
on api.leads
for update
using (
  user_id = auth.uid()
  or (organization_id is not null and api.has_organization_role(organization_id, array['owner', 'admin', 'member']))
)
with check (
  user_id = auth.uid()
  or (organization_id is not null and api.has_organization_role(organization_id, array['owner', 'admin', 'member']))
);

drop policy if exists subscriptions_select_organization on api.subscriptions;
create policy subscriptions_select_organization
on api.subscriptions
for select
using (
  user_id = auth.uid()
  or (organization_id is not null and api.is_organization_member(organization_id))
);

drop policy if exists subscriptions_insert_organization on api.subscriptions;
create policy subscriptions_insert_organization
on api.subscriptions
for insert
with check (
  user_id = auth.uid()
  and (
    organization_id is null
    or api.is_organization_member(organization_id)
  )
);

drop policy if exists subscriptions_update_organization on api.subscriptions;
create policy subscriptions_update_organization
on api.subscriptions
for update
using (
  user_id = auth.uid()
  or (organization_id is not null and api.has_organization_role(organization_id, array['owner', 'admin']))
)
with check (
  user_id = auth.uid()
  or (organization_id is not null and api.has_organization_role(organization_id, array['owner', 'admin']))
);

drop policy if exists usage_events_select_organization on api.usage_events;
create policy usage_events_select_organization
on api.usage_events
for select
using (
  user_id = auth.uid()
  or (organization_id is not null and api.is_organization_member(organization_id))
);

drop policy if exists audit_logs_select_organization on api.audit_logs;
create policy audit_logs_select_organization
on api.audit_logs
for select
using (
  (organization_id is not null and api.is_organization_member(organization_id))
  or (workspace_id is not null and api.is_workspace_member(workspace_id))
);

drop policy if exists audit_logs_insert_organization on api.audit_logs;
create policy audit_logs_insert_organization
on api.audit_logs
for insert
with check (
  actor_user_id = auth.uid()
  and (
    (organization_id is not null and api.has_organization_role(organization_id, array['owner', 'admin']))
    or (workspace_id is not null and api.has_workspace_role(workspace_id, array['owner', 'admin']))
  )
);

-- -----------------------------
-- Grants
-- -----------------------------
grant usage on schema api to authenticated;
grant select, insert, update, delete on api.organizations to authenticated;
grant select, insert, update, delete on api.profiles to authenticated;
grant select, insert, update, delete on api.lead_enrichment to authenticated;
grant select, insert, update, delete on api.lead_scores to authenticated;
grant select, insert, update, delete on api.campaigns to authenticated;
grant select, insert, update, delete on api.campaign_leads to authenticated;
grant select, insert, update, delete on api.ai_generations to authenticated;
grant select, insert, update, delete on api.saved_searches to authenticated;

notify pgrst, 'reload schema';
commit;
