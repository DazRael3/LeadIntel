begin;

set local search_path = public, extensions, api;

alter table api.user_reports
  add column if not exists sources_used jsonb not null default '[]'::jsonb,
  add column if not exists sources_fetched_at timestamptz null,
  add column if not exists report_kind text not null default 'competitive',
  add column if not exists report_version int not null default 1;

-- Backfill: historical rows created from pitch generator should not show in competitive reports list.
update api.user_reports
set report_kind = 'pitch'
where report_kind = 'competitive'
  and coalesce(meta->>'source','') = 'generate_pitch';

notify pgrst, 'reload schema';
commit;

