-- 0028_job_runs_and_growth_alerts.sql
-- Server-only tables for automation observability (idempotent).

begin;

create table if not exists api.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  triggered_by text not null,
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  summary jsonb not null default '{}'::jsonb,
  error_text text,
  created_at timestamptz not null default now()
);

create index if not exists job_runs_job_name_idx on api.job_runs(job_name);
create index if not exists job_runs_started_at_idx on api.job_runs(started_at desc);

alter table api.job_runs enable row level security;

-- Deny all access to authenticated users (service role bypasses RLS).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='job_runs' and policyname='job_runs_no_access') then
    create policy "job_runs_no_access" on api.job_runs
    for all to authenticated
    using (false) with check (false);
  end if;
end $$;

create table if not exists api.growth_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  metric text not null,
  window_key text not null,
  current_count int not null,
  previous_count int not null,
  drop_pct numeric not null,
  emailed_to text,
  email_status text not null,
  details jsonb not null default '{}'::jsonb
);

create index if not exists growth_alerts_created_at_idx on api.growth_alerts(created_at desc);
create index if not exists growth_alerts_metric_idx on api.growth_alerts(metric);

alter table api.growth_alerts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='growth_alerts' and policyname='growth_alerts_no_access') then
    create policy "growth_alerts_no_access" on api.growth_alerts
    for all to authenticated
    using (false) with check (false);
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

