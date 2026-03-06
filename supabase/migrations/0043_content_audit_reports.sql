begin;

-- Content audit reports (structured, actionable)
create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

create table if not exists api.content_audit_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null check (status in ('ok', 'warn', 'error')),
  failures jsonb not null default '[]'::jsonb,
  summary text not null
);

create index if not exists content_audit_reports_created_at_idx on api.content_audit_reports (created_at desc);

alter table api.content_audit_reports enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'api'
      and tablename = 'content_audit_reports'
      and policyname = 'content_audit_reports_no_access'
  ) then
    create policy "content_audit_reports_no_access"
      on api.content_audit_reports
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
