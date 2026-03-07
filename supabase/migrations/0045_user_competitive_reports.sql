begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

create table if not exists api.user_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null check (status in ('draft','complete','failed')) default 'complete',
  company_name text not null,
  company_domain text null,
  input_url text null,
  title text not null,
  report_markdown text not null,
  report_json jsonb null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists user_reports_user_id_created_at_idx on api.user_reports (user_id, created_at desc);

-- updated_at maintenance (uses api.set_updated_at if present)
drop trigger if exists set_user_reports_updated_at on api.user_reports;
create trigger set_user_reports_updated_at
before update on api.user_reports
for each row
execute procedure api.set_updated_at();

alter table api.user_reports enable row level security;

drop policy if exists read_own_reports on api.user_reports;
create policy "read_own_reports"
on api.user_reports
for select
using (auth.uid() = user_id);

drop policy if exists insert_own_reports on api.user_reports;
create policy "insert_own_reports"
on api.user_reports
for insert
with check (auth.uid() = user_id);

drop policy if exists update_own_reports on api.user_reports;
create policy "update_own_reports"
on api.user_reports
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
commit;

