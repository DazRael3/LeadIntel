begin;

set local search_path = public, extensions, api;

-- Expand api.users.subscription_tier allowed values to match application tier resolver.
-- Safe to re-run; drops/recreates the check constraint when present.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'api.users'::regclass
      and conname = 'users_subscription_tier_check'
  ) then
    alter table api.users drop constraint users_subscription_tier_check;
  end if;
exception when undefined_table then
  -- ignore
end $$;

do $$
begin
  alter table api.users
    add constraint users_subscription_tier_check
    check (subscription_tier in ('free', 'pro', 'closer_plus', 'team'));
exception when undefined_table then
  -- ignore
end $$;

notify pgrst, 'reload schema';
commit;

