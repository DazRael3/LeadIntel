-- 0029_job_locks.sql
-- Best-effort concurrency guard for cron/admin jobs (service-role only).

begin;

create table if not exists api.job_locks (
  job_name text primary key,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table api.job_locks enable row level security;

-- Deny all access to authenticated users (service role bypasses RLS).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='job_locks' and policyname='job_locks_no_access') then
    create policy "job_locks_no_access" on api.job_locks
    for all to authenticated
    using (false) with check (false);
  end if;
end $$;

create or replace function api.try_acquire_job_lock(p_job_name text, p_ttl_seconds int)
returns boolean
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_until timestamptz := v_now + make_interval(secs => greatest(p_ttl_seconds, 1));
  v_rows int := 0;
begin
  insert into api.job_locks(job_name, locked_until, updated_at)
  values (p_job_name, v_until, v_now)
  on conflict (job_name) do update
    set locked_until = excluded.locked_until,
        updated_at = excluded.updated_at
    where api.job_locks.locked_until < v_now;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

create or replace function api.release_job_lock(p_job_name text)
returns void
language sql
as $$
  delete from api.job_locks where job_name = p_job_name;
$$;

notify pgrst, 'reload schema';

commit;

