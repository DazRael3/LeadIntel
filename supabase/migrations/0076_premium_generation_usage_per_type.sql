begin;

-- Update free-tier reservation logic to enforce per-type caps (3 pitches + 3 reports),
-- while keeping concurrency safety and short-lived reservations.
--
-- IMPORTANT:
-- - This does not change how completion is recorded; object_type/object_id are still
--   set on complete_premium_generation().
-- - This keeps reservations fail-safe: on any unexpected condition, return null.

set local search_path = public, extensions, api;

create or replace function api.reserve_premium_generation(
  expires_seconds integer default 600,
  p_object_type text default null
)
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

  if p_object_type is null or p_object_type not in ('pitch','report') then
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

  -- Per-type cap: 3 completed + active reservations for that object_type.
  select count(*) into v_complete_count
  from api.usage_events
  where user_id = v_user_id
    and status = 'complete'
    and object_type = p_object_type;

  select count(*) into v_active_reservations
  from api.usage_events
  where user_id = v_user_id
    and status = 'reserved'
    and (expires_at is null or expires_at > v_now)
    and meta->>'object_type' = p_object_type;

  if (v_complete_count + v_active_reservations) >= 3 then
    return null;
  end if;

  insert into api.usage_events (user_id, status, expires_at, meta)
  values (
    v_user_id,
    'reserved',
    v_expires,
    jsonb_build_object('kind','premium_generation', 'object_type', p_object_type)
  )
  returning id into v_reservation_id;

  return v_reservation_id;
end $$;

revoke all on function api.reserve_premium_generation(integer, text) from public;
grant execute on function api.reserve_premium_generation(integer, text) to authenticated;

-- Note: we keep the legacy signature `api.reserve_premium_generation(integer)` intact
-- (from migration 0048) so older deployments/clients keep working during rollout.
--
-- IMPORTANT: legacy calls will still enforce the old combined-cap behavior until
-- the caller is updated to pass `p_object_type`. We update app callers in this repo.

notify pgrst, 'reload schema';
commit;

