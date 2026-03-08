begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- Company profiles keyed by normalized company_key (domain preferred, else slugified name).
create table if not exists api.company_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_key text not null unique,
  company_name text not null,
  company_domain text null,
  input_url text null
);

-- updated_at maintenance (uses api.set_updated_at if present)
drop trigger if exists set_company_profiles_updated_at on api.company_profiles;
create trigger set_company_profiles_updated_at
before update on api.company_profiles
for each row
execute procedure api.set_updated_at();

create table if not exists api.company_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_key text not null references api.company_profiles(company_key) on delete cascade,
  source_type text not null check (source_type in ('gdelt','first_party','greenhouse','lever','sec')),
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null check (status in ('ok','error')) default 'ok',
  payload jsonb not null default '{}'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists company_source_snapshots_company_type_fetched_idx
  on api.company_source_snapshots (company_key, source_type, fetched_at desc);

create index if not exists company_source_snapshots_expires_at_idx
  on api.company_source_snapshots (expires_at);

alter table api.company_profiles enable row level security;
alter table api.company_source_snapshots enable row level security;

-- Internal-only tables: deny reads/writes for anon/authenticated. Service role bypasses RLS.
drop policy if exists company_profiles_no_access on api.company_profiles;
create policy company_profiles_no_access
on api.company_profiles
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists company_source_snapshots_no_access on api.company_source_snapshots;
create policy company_source_snapshots_no_access
on api.company_source_snapshots
for all
to anon, authenticated
using (false)
with check (false);

notify pgrst, 'reload schema';
commit;

