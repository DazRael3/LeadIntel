begin;

set local search_path = public, extensions, api;

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- Demo handoff sessions (server-only claim flow)
-- -------------------------------------------------------------------
create table if not exists api.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_ip text null,
  user_agent_hash text null,
  claimed_user_id uuid null references auth.users(id) on delete set null,
  claimed_workspace_id uuid null references api.workspaces(id) on delete set null,
  claimed_lead_id uuid null references api.leads(id) on delete set null
);

alter table api.demo_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'demo_sessions_expires_at_idx'
  ) then
    create index demo_sessions_expires_at_idx on api.demo_sessions (expires_at);
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'demo_sessions_consumed_at_idx'
  ) then
    create index demo_sessions_consumed_at_idx on api.demo_sessions (consumed_at);
  end if;
end $$;

-- -------------------------------------------------------------------
-- Campaign persistence
-- -------------------------------------------------------------------
create table if not exists api.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  objective text null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table api.campaigns enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'api.campaigns'::regclass
      and conname = 'campaigns_name_not_blank'
  ) then
    alter table api.campaigns
      add constraint campaigns_name_not_blank
      check (length(btrim(name)) > 0 and length(name) <= 160);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'campaigns_workspace_created_idx'
  ) then
    create index campaigns_workspace_created_idx on api.campaigns (workspace_id, created_at desc);
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'campaigns_created_by_idx'
  ) then
    create index campaigns_created_by_idx on api.campaigns (created_by);
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'campaigns_workspace_name_unique'
  ) then
    create unique index campaigns_workspace_name_unique
      on api.campaigns (workspace_id, lower(name));
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'campaigns_id_workspace_unique'
  ) then
    create unique index campaigns_id_workspace_unique
      on api.campaigns (id, workspace_id);
  end if;
end $$;

drop trigger if exists trg_campaigns_updated_at on api.campaigns;
create trigger trg_campaigns_updated_at
before update on api.campaigns
for each row execute function public.set_updated_at();

create table if not exists api.campaign_leads (
  campaign_id uuid not null,
  lead_id uuid not null references api.leads(id) on delete cascade,
  workspace_id uuid not null,
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, lead_id),
  constraint campaign_leads_campaign_workspace_fk
    foreign key (campaign_id, workspace_id)
    references api.campaigns(id, workspace_id)
    on delete cascade
);

alter table api.campaign_leads enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'campaign_leads_workspace_created_idx'
  ) then
    create index campaign_leads_workspace_created_idx on api.campaign_leads (workspace_id, created_at desc);
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'campaign_leads_lead_id_idx'
  ) then
    create index campaign_leads_lead_id_idx on api.campaign_leads (lead_id);
  end if;
end $$;

-- -------------------------------------------------------------------
-- Campaign RLS policies
-- -------------------------------------------------------------------
drop policy if exists campaigns_select on api.campaigns;
create policy campaigns_select
on api.campaigns
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists campaigns_insert_writer on api.campaigns;
create policy campaigns_insert_writer
on api.campaigns
for insert
with check (
  api.has_workspace_role(workspace_id, array['owner','admin','manager','rep'])
  and created_by = auth.uid()
);

drop policy if exists campaigns_update_writer on api.campaigns;
create policy campaigns_update_writer
on api.campaigns
for update
using (
  api.has_workspace_role(workspace_id, array['owner','admin','manager'])
  or (api.has_workspace_role(workspace_id, array['rep']) and created_by = auth.uid())
)
with check (
  api.has_workspace_role(workspace_id, array['owner','admin','manager'])
  or (api.has_workspace_role(workspace_id, array['rep']) and created_by = auth.uid())
);

drop policy if exists campaigns_delete_writer on api.campaigns;
create policy campaigns_delete_writer
on api.campaigns
for delete
using (
  api.has_workspace_role(workspace_id, array['owner','admin','manager'])
  or (api.has_workspace_role(workspace_id, array['rep']) and created_by = auth.uid())
);

drop policy if exists campaign_leads_select on api.campaign_leads;
create policy campaign_leads_select
on api.campaign_leads
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists campaign_leads_insert_writer on api.campaign_leads;
create policy campaign_leads_insert_writer
on api.campaign_leads
for insert
with check (
  api.has_workspace_role(workspace_id, array['owner','admin','manager','rep'])
  and added_by = auth.uid()
);

drop policy if exists campaign_leads_delete_writer on api.campaign_leads;
create policy campaign_leads_delete_writer
on api.campaign_leads
for delete
using (api.has_workspace_role(workspace_id, array['owner','admin','manager','rep']));

grant select, insert, update, delete on api.campaigns to authenticated;
grant select, insert, delete on api.campaign_leads to authenticated;

notify pgrst, 'reload schema';
commit;
