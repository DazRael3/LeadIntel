begin;

set local search_path = public, extensions, api;

-- Identify review/demo sessions via auth JWT user_metadata flag.
create or replace function api.is_review_user()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'user_metadata' ->> 'review_mode')::boolean, false);
$$;

revoke all on function api.is_review_user() from public;
grant execute on function api.is_review_user() to authenticated;

-- Restrictive RLS policies: block writes for review users without breaking read access.
-- Policies are idempotent; if table doesn't exist in an older env, ignore.
do $$
begin
  -- api.leads
  begin
    alter table api.leads enable row level security;
    drop policy if exists leads_block_review_insert on api.leads;
    create policy leads_block_review_insert on api.leads
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists leads_block_review_update on api.leads;
    create policy leads_block_review_update on api.leads
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists leads_block_review_delete on api.leads;
    create policy leads_block_review_delete on api.leads
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  -- api.trigger_events
  begin
    alter table api.trigger_events enable row level security;
    drop policy if exists trigger_events_block_review_insert on api.trigger_events;
    create policy trigger_events_block_review_insert on api.trigger_events
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists trigger_events_block_review_update on api.trigger_events;
    create policy trigger_events_block_review_update on api.trigger_events
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists trigger_events_block_review_delete on api.trigger_events;
    create policy trigger_events_block_review_delete on api.trigger_events
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  -- api.users
  begin
    alter table api.users enable row level security;
    drop policy if exists users_block_review_update on api.users;
    create policy users_block_review_update on api.users
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists users_block_review_insert on api.users;
    create policy users_block_review_insert on api.users
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists users_block_review_delete on api.users;
    create policy users_block_review_delete on api.users
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  -- api.user_settings
  begin
    alter table api.user_settings enable row level security;
    drop policy if exists user_settings_block_review_update on api.user_settings;
    create policy user_settings_block_review_update on api.user_settings
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists user_settings_block_review_insert on api.user_settings;
    create policy user_settings_block_review_insert on api.user_settings
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists user_settings_block_review_delete on api.user_settings;
    create policy user_settings_block_review_delete on api.user_settings
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  -- api.pitches
  begin
    alter table api.pitches enable row level security;
    drop policy if exists pitches_block_review_insert on api.pitches;
    create policy pitches_block_review_insert on api.pitches
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists pitches_block_review_update on api.pitches;
    create policy pitches_block_review_update on api.pitches
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists pitches_block_review_delete on api.pitches;
    create policy pitches_block_review_delete on api.pitches
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;
end $$;

notify pgrst, 'reload schema';
commit;

