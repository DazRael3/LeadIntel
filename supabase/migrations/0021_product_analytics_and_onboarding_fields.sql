-- 0021_product_analytics_and_onboarding_fields.sql
-- Adds product analytics + optional trial fingerprinting tables, and extends onboarding profile fields.
-- Safe to re-run (idempotent).

begin;

-- --------------------------------------------
-- Product analytics (server-written; no client reads)
-- --------------------------------------------
create table if not exists api.product_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_analytics_user_created_idx
  on api.product_analytics (user_id, created_at desc);

alter table api.product_analytics enable row level security;

do $$
begin
  -- Allow users to insert events for themselves (no SELECT policy is created intentionally).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'api'
      and tablename = 'product_analytics'
      and policyname = 'product_analytics_insert_own'
  ) then
    create policy "product_analytics_insert_own"
      on api.product_analytics
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

grant usage on schema api to authenticated;
grant insert on api.product_analytics to authenticated;

-- --------------------------------------------
-- Trial fingerprinting (optional; server/admin reads only)
-- --------------------------------------------
create table if not exists api.user_fingerprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  signup_ip text,
  signup_user_agent_hash text,
  created_at timestamptz not null default now()
);

alter table api.user_fingerprints enable row level security;

do $$
begin
  -- Allow users to insert their own fingerprint record (no SELECT policy is created intentionally).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'api'
      and tablename = 'user_fingerprints'
      and policyname = 'user_fingerprints_insert_own'
  ) then
    create policy "user_fingerprints_insert_own"
      on api.user_fingerprints
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

grant insert on api.user_fingerprints to authenticated;

-- --------------------------------------------
-- Onboarding profile fields (stored on api.user_settings)
-- --------------------------------------------
alter table api.user_settings
  add column if not exists role text,
  add column if not exists team_size text,
  add column if not exists primary_goal text,
  add column if not exists heard_about_us_from text;

-- Ensure PostgREST reloads schema after new tables/columns are added
notify pgrst, 'reload schema';

commit;

