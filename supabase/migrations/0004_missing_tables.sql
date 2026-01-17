BEGIN;

create schema if not exists api;

-- Visitors feed (used by realtime UI)
create table if not exists api.website_visitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_address text,
  company_name text,
  company_domain text,
  company_industry text,
  visited_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Watchlist (user saved companies)
create table if not exists api.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text,
  company_domain text,
  company_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watchlist_user_id_idx on api.watchlist(user_id);

-- Email logs (send-pitch auditing)
create table if not exists api.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references api.leads(id) on delete set null,
  to_email text,
  from_email text,
  subject text,
  provider text,
  status text,
  error text,
  created_at timestamptz not null default now()
);

-- Stripe webhook event log (debug)
create table if not exists api.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text unique,
  type text,
  livemode boolean,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  processed_at timestamptz,
  error text
);

-- RLS on new tables
alter table api.website_visitors enable row level security;
alter table api.watchlist enable row level security;
alter table api.email_logs enable row level security;
alter table api.stripe_webhook_events enable row level security;

-- Policies: per-user isolation
drop policy if exists "website_visitors_rw_own" on api.website_visitors;
create policy "website_visitors_rw_own" on api.website_visitors
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "watchlist_rw_own" on api.watchlist;
create policy "watchlist_rw_own" on api.watchlist
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "email_logs_rw_own" on api.email_logs;
create policy "email_logs_rw_own" on api.email_logs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Stripe events: readable only by service role (keep locked down)
drop policy if exists "stripe_events_no_access" on api.stripe_webhook_events;
create policy "stripe_events_no_access" on api.stripe_webhook_events
  for all to authenticated
  using (false)
  with check (false);

COMMIT;
