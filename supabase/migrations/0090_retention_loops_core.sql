begin;

set local search_path = public, extensions, api;

-- -------------------------------------------------------------------
-- Lead freshness tracking
-- -------------------------------------------------------------------
alter table api.leads
  add column if not exists generated_at timestamptz;

update api.leads
set generated_at = coalesce(generated_at, created_at, now())
where generated_at is null;

alter table api.leads
  alter column generated_at set default now();

alter table api.leads
  alter column generated_at set not null;

create index if not exists leads_user_generated_at_idx
  on api.leads (user_id, generated_at desc);

-- -------------------------------------------------------------------
-- User settings stamp for "new leads since last visit"
-- -------------------------------------------------------------------
alter table api.user_settings
  add column if not exists last_lead_library_seen_at timestamptz;

-- -------------------------------------------------------------------
-- Saved searches (retention loop core)
-- -------------------------------------------------------------------
create table if not exists api.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  query_payload jsonb not null default '{}'::jsonb,
  last_run_at timestamptz null,
  last_notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_searches_name_not_blank
    check (length(btrim(name)) > 0 and length(name) <= 120)
);

alter table api.saved_searches enable row level security;

drop trigger if exists trg_saved_searches_updated_at on api.saved_searches;
create trigger trg_saved_searches_updated_at
before update on api.saved_searches
for each row execute function public.set_updated_at();

create index if not exists saved_searches_user_updated_idx
  on api.saved_searches (user_id, updated_at desc);

create index if not exists saved_searches_user_last_run_idx
  on api.saved_searches (user_id, last_run_at desc nulls last);

drop policy if exists saved_searches_select_own on api.saved_searches;
create policy saved_searches_select_own
on api.saved_searches
for select
using (auth.uid() = user_id);

drop policy if exists saved_searches_insert_own on api.saved_searches;
create policy saved_searches_insert_own
on api.saved_searches
for insert
with check (auth.uid() = user_id);

drop policy if exists saved_searches_update_own on api.saved_searches;
create policy saved_searches_update_own
on api.saved_searches
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists saved_searches_delete_own on api.saved_searches;
create policy saved_searches_delete_own
on api.saved_searches
for delete
using (auth.uid() = user_id);

grant select, insert, update, delete on api.saved_searches to authenticated;

-- -------------------------------------------------------------------
-- Campaign pipeline statuses for progress tracking
-- -------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'api.campaigns'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table api.campaigns drop constraint if exists %I', c.conname);
  end loop;
end $$;

update api.campaigns
set status = 'new'
where status = 'draft';

alter table api.campaigns
  alter column status set default 'new';

alter table api.campaigns
  add constraint campaigns_status_check
  check (
    status in (
      'new',
      'contacted',
      'responded',
      'closed',
      'active',
      'paused',
      'archived'
    )
  );

notify pgrst, 'reload schema';
commit;
