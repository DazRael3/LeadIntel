begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- Usage ledger for premium generations (pitches + reports).
-- This exists to enforce the combined free-tier cap server-side, robustly, even under concurrency.
create table if not exists api.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('reserved','complete','cancelled')) default 'reserved',
  object_type text null check (object_type in ('pitch','report')),
  object_id uuid null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists usage_events_user_created_at_idx on api.usage_events (user_id, created_at desc);
create index if not exists usage_events_expires_at_idx on api.usage_events (expires_at);

-- Idempotency for completion: the same object should never be counted twice.
do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'usage_events_user_object_unique'
  ) then
    create unique index usage_events_user_object_unique
      on api.usage_events (user_id, object_type, object_id)
      where object_type is not null and object_id is not null;
  end if;
end $$;

alter table api.usage_events enable row level security;

-- Allow users to read their own usage events (needed to compute usage server-side without service role).
-- This table contains no premium content; only counts and object ids/types.
drop policy if exists usage_events_select_own on api.usage_events;
create policy "usage_events_select_own"
on api.usage_events
for select
to authenticated
using (auth.uid() = user_id);

-- Helper: reserve a free-tier premium generation slot (short-lived).
-- IMPORTANT: This is a reservation only; it does NOT count as "used" until marked complete.
create or replace function api.reserve_premium_generation(expires_seconds integer default 600)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, api
as $$
declare
  v_user_id uuid;
  v_reservation_id uuid;
  v_now timestamptz;
  v_expires timestamptz;
  v_complete_count integer;
  v_active_reservations integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return null;
  end if;

  v_now := now();
  v_expires := v_now + make_interval(secs => greatest(60, least(3600, coalesce(expires_seconds, 600))));

  -- Serialize reservations per user to avoid concurrency bypasses.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  -- Clean up expired reservations.
  update api.usage_events
    set status = 'cancelled'
  where user_id = v_user_id
    and status = 'reserved'
    and expires_at is not null
    and expires_at <= v_now;

  select count(*) into v_complete_count
  from api.usage_events
  where user_id = v_user_id
    and status = 'complete';

  select count(*) into v_active_reservations
  from api.usage_events
  where user_id = v_user_id
    and status = 'reserved'
    and (expires_at is null or expires_at > v_now);

  -- Cap is enforced at 3 total across pitch + report.
  if (v_complete_count + v_active_reservations) >= 3 then
    return null;
  end if;

  insert into api.usage_events (user_id, status, expires_at, meta)
  values (v_user_id, 'reserved', v_expires, jsonb_build_object('kind','premium_generation'))
  returning id into v_reservation_id;

  return v_reservation_id;
end $$;

create or replace function api.complete_premium_generation(p_reservation_id uuid, p_object_type text, p_object_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, api
as $$
declare
  v_user_id uuid;
  v_now timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return false;
  end if;
  if p_reservation_id is null or p_object_type is null or p_object_id is null then
    return false;
  end if;
  if p_object_type not in ('pitch','report') then
    return false;
  end if;

  v_now := now();
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  -- Mark reservation complete if it is still active.
  update api.usage_events
    set status = 'complete',
        object_type = p_object_type,
        object_id = p_object_id,
        expires_at = null,
        meta = meta || jsonb_build_object('completed_at', v_now)
  where id = p_reservation_id
    and user_id = v_user_id
    and status = 'reserved'
    and (expires_at is null or expires_at > v_now);

  return found;
end $$;

create or replace function api.cancel_premium_generation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, api
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null or p_reservation_id is null then
    return false;
  end if;

  update api.usage_events
    set status = 'cancelled',
        expires_at = null,
        meta = meta || jsonb_build_object('cancelled_at', now())
  where id = p_reservation_id
    and user_id = v_user_id
    and status = 'reserved';

  return found;
end $$;

revoke all on table api.usage_events from public;
grant select on api.usage_events to authenticated;
revoke all on function api.reserve_premium_generation(integer) from public;
revoke all on function api.complete_premium_generation(uuid, text, uuid) from public;
revoke all on function api.cancel_premium_generation(uuid) from public;
grant execute on function api.reserve_premium_generation(integer) to authenticated;
grant execute on function api.complete_premium_generation(uuid, text, uuid) to authenticated;
grant execute on function api.cancel_premium_generation(uuid) to authenticated;

-- Backfill existing generations so the cap is consistent after deploy.
-- Note: this writes one row per existing pitch/report (idempotent via unique index).
insert into api.usage_events (user_id, status, object_type, object_id, created_at, meta)
select p.user_id, 'complete', 'pitch', p.id, coalesce(p.created_at, now()), jsonb_build_object('backfill', true)
from api.pitches p
on conflict do nothing;

insert into api.usage_events (user_id, status, object_type, object_id, created_at, meta)
select r.user_id, 'complete', 'report', r.id, coalesce(r.created_at, now()), jsonb_build_object('backfill', true, 'report_kind', r.report_kind)
from api.user_reports r
where r.status = 'complete'
  and r.report_kind in ('competitive', 'account_brief')
on conflict do nothing;

notify pgrst, 'reload schema';
commit;

