begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

create table if not exists api.kpi_monitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_started_at timestamptz null,
  run_finished_at timestamptz null,
  metric text not null,
  window text not null check (window in ('24h', '7d')),
  current bigint not null,
  previous bigint not null,
  drop_pct numeric not null,
  alert boolean not null,
  note text null,
  reason text null
);

create index if not exists kpi_monitor_snapshots_metric_window_created_at_idx
  on api.kpi_monitor_snapshots (metric, window, created_at desc);

alter table api.kpi_monitor_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'api'
      and tablename = 'kpi_monitor_snapshots'
      and policyname = 'kpi_monitor_snapshots_no_access'
  ) then
    create policy "kpi_monitor_snapshots_no_access"
      on api.kpi_monitor_snapshots
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end $$;

notify pgrst, 'reload schema';
commit;

