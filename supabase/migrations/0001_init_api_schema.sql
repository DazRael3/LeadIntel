-- LeadIntel: reset + create api schema tables (NO VIEWS), RLS, policies, grants
-- Safe to re-run. Includes safe drop logic that handles "table vs view" correctly (fixes ERROR 42809).

begin;

-- Extensions (gen_random_uuid)
create extension if not exists pgcrypto;

-- Schema
create schema if not exists api;

-- A helper function to set updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- SAFE DROP: drops a relation whether it is a table or a view (prevents ERROR 42809)
do $$
declare
  r record;
  targets text[] := array['users','user_settings','leads','trigger_events','subscriptions'];
begin
  foreach r in array targets loop
    -- drop view if it exists as a view
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'api' and c.relname = r and c.relkind in ('v','m')
    ) then
      execute format('drop view if exists api.%I cascade', r);
    end if;

    -- drop table if it exists as a table
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'api' and c.relname = r and c.relkind in ('r','p')
    ) then
      execute format('drop table if exists api.%I cascade', r);
    end if;
  end loop;
end $$;

-- TABLE: api.users (1 row per auth user, for app-level metadata)
create table api.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_users_updated_at
before update on api.users
for each row execute function public.set_updated_at();

alter table api.users enable row level security;

create policy "users_select_own"
on api.users for select
to authenticated
using (id = auth.uid());

create policy "users_insert_own"
on api.users for insert
to authenticated
with check (id = auth.uid());

create policy "users_update_own"
on api.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "users_delete_own"
on api.users for delete
to authenticated
using (id = auth.uid());

-- TABLE: api.user_settings
create table api.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  from_name text,
  from_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_user_settings_updated_at
before update on api.user_settings
for each row execute function public.set_updated_at();

alter table api.user_settings enable row level security;

create policy "user_settings_select_own"
on api.user_settings for select
to authenticated
using (user_id = auth.uid());

create policy "user_settings_upsert_own"
on api.user_settings for insert
to authenticated
with check (user_id = auth.uid());

create policy "user_settings_update_own"
on api.user_settings for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user_settings_delete_own"
on api.user_settings for delete
to authenticated
using (user_id = auth.uid());

-- TABLE: api.leads
create table api.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_url text not null,
  company_domain text,
  company_name text,
  ai_personalized_pitch text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_user_id_idx on api.leads(user_id);
create index leads_company_domain_idx on api.leads(company_domain);

create trigger trg_leads_updated_at
before update on api.leads
for each row execute function public.set_updated_at();

alter table api.leads enable row level security;

create policy "leads_select_own"
on api.leads for select
to authenticated
using (user_id = auth.uid());

create policy "leads_insert_own"
on api.leads for insert
to authenticated
with check (user_id = auth.uid());

create policy "leads_update_own"
on api.leads for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "leads_delete_own"
on api.leads for delete
to authenticated
using (user_id = auth.uid());

-- TABLE: api.trigger_events
create table api.trigger_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references api.leads(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index trigger_events_user_id_idx on api.trigger_events(user_id);
create index trigger_events_lead_id_idx on api.trigger_events(lead_id);

alter table api.trigger_events enable row level security;

create policy "trigger_events_select_own"
on api.trigger_events for select
to authenticated
using (user_id = auth.uid());

create policy "trigger_events_insert_own"
on api.trigger_events for insert
to authenticated
with check (user_id = auth.uid());

create policy "trigger_events_delete_own"
on api.trigger_events for delete
to authenticated
using (user_id = auth.uid());

-- TABLE: api.subscriptions
create table api.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text,
  stripe_customer_id text,
  status text,
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscriptions_stripe_subscription_id_uq
on api.subscriptions(stripe_subscription_id);

create index subscriptions_user_id_idx on api.subscriptions(user_id);

create trigger trg_subscriptions_updated_at
before update on api.subscriptions
for each row execute function public.set_updated_at();

alter table api.subscriptions enable row level security;

create policy "subscriptions_select_own"
on api.subscriptions for select
to authenticated
using (user_id = auth.uid());

create policy "subscriptions_insert_own"
on api.subscriptions for insert
to authenticated
with check (user_id = auth.uid());

create policy "subscriptions_update_own"
on api.subscriptions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "subscriptions_delete_own"
on api.subscriptions for delete
to authenticated
using (user_id = auth.uid());

-- GRANTS (fixes "permission denied for table user_settings")
grant usage on schema api to authenticated;
grant select, insert, update, delete on
  api.users,
  api.user_settings,
  api.leads,
  api.trigger_events,
  api.subscriptions
to authenticated;

commit;
