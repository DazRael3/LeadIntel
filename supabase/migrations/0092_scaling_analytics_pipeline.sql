begin;

set local search_path = public, extensions, api;

-- Extend growth event taxonomy for scaling/funnel analytics.
-- This is additive and idempotent.
alter table if exists api.growth_events
  add column if not exists source text not null default 'app',
  add column if not exists session_id text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_events_source_check'
      and connamespace = 'api'::regnamespace
  ) then
    alter table api.growth_events
      add constraint growth_events_source_check
      check (source in ('app', 'pixel_meta', 'pixel_tiktok', 'server', 'import'));
  end if;
end $$;

create index if not exists growth_events_workspace_event_created_idx
  on api.growth_events (workspace_id, event_name, created_at desc);

create index if not exists growth_events_workspace_source_created_idx
  on api.growth_events (workspace_id, source, created_at desc);

create index if not exists growth_events_workspace_user_created_idx
  on api.growth_events (workspace_id, user_id, created_at desc);

-- Scaling funnel snapshot RPC (directional metrics only).
drop function if exists api.scaling_funnel_snapshot(uuid, timestamptz);
create or replace function api.scaling_funnel_snapshot(
  p_workspace_id uuid,
  p_since timestamptz
)
returns table (
  event_name text,
  total bigint,
  users bigint
)
language sql
stable
as $$
  select
    ge.event_name,
    count(*)::bigint as total,
    count(distinct ge.user_id)::bigint as users
  from api.growth_events ge
  where ge.workspace_id = p_workspace_id
    and ge.created_at >= p_since
  group by ge.event_name
  order by total desc;
$$;

revoke all on function api.scaling_funnel_snapshot(uuid, timestamptz) from public;
grant execute on function api.scaling_funnel_snapshot(uuid, timestamptz) to authenticated;
grant execute on function api.scaling_funnel_snapshot(uuid, timestamptz) to service_role;

notify pgrst, 'reload schema';
commit;
