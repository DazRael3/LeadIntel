begin;

set local search_path = public, extensions, api;

-- --------------------------------------------
-- Competitive report snapshots (Closer+): refresh + diff
-- - Stores immutable snapshots for each competitive report generation
-- - Enables diff between successive snapshots
-- - Idempotent and safe to re-run
-- --------------------------------------------

create extension if not exists pgcrypto;

create table if not exists api.user_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references api.user_reports(id) on delete cascade,
  report_kind text not null default 'competitive',
  report_version int not null default 1,
  created_at timestamptz not null default now(),
  company_name text not null,
  company_domain text null,
  input_url text null,
  title text not null,
  report_markdown text not null,
  report_json jsonb null,
  sources_used jsonb not null default '[]'::jsonb,
  sources_fetched_at timestamptz null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists user_report_snapshots_report_created_idx
  on api.user_report_snapshots (report_id, created_at desc);
create index if not exists user_report_snapshots_user_created_idx
  on api.user_report_snapshots (user_id, created_at desc);

alter table api.user_report_snapshots enable row level security;

drop policy if exists user_report_snapshots_select_own on api.user_report_snapshots;
create policy user_report_snapshots_select_own
on api.user_report_snapshots
for select
using (auth.uid() = user_id);

drop policy if exists user_report_snapshots_write_own on api.user_report_snapshots;
create policy user_report_snapshots_write_own
on api.user_report_snapshots
for insert
with check (auth.uid() = user_id);

drop policy if exists user_report_snapshots_update_none on api.user_report_snapshots;
create policy user_report_snapshots_update_none
on api.user_report_snapshots
for update
using (false)
with check (false);

drop policy if exists user_report_snapshots_delete_none on api.user_report_snapshots;
create policy user_report_snapshots_delete_none
on api.user_report_snapshots
for delete
using (false);

grant select, insert on api.user_report_snapshots to authenticated;

notify pgrst, 'reload schema';
commit;

