-- Adds service-role-only daily site reports + user communication preferences fields.
-- Safe to re-run (idempotent).

begin;

-- --------------------------------------------
-- Daily site reports (service-role only)
-- --------------------------------------------
create table if not exists api.site_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  generated_at timestamptz not null default now(),
  summary jsonb not null,
  notes text
);

-- One report per day
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'api.site_reports'::regclass
      and conname = 'site_reports_report_date_key'
  ) then
    alter table api.site_reports
      add constraint site_reports_report_date_key unique (report_date);
  end if;
end $$;

alter table api.site_reports enable row level security;

-- Hard "service-role only": do not grant table privileges to anon/authenticated.
revoke all on table api.site_reports from anon;
revoke all on table api.site_reports from authenticated;

-- Note: service_role bypasses RLS; no policies are created intentionally.

-- --------------------------------------------
-- User settings: communication preferences
-- --------------------------------------------
alter table api.user_settings
  add column if not exists preferred_contact_channel text,
  add column if not exists preferred_contact_detail text,
  add column if not exists allow_product_updates boolean not null default true;

notify pgrst, 'reload schema';
commit;

