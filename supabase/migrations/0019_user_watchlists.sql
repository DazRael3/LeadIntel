begin;

-- Per-user market watchlists (stocks + crypto)
create table if not exists api.user_watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('stock','crypto')),
  symbol text not null,
  display_name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, kind, symbol)
);

create index if not exists user_watchlists_user_sort_idx
  on api.user_watchlists(user_id, sort_order);

alter table api.user_watchlists enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'api' and tablename = 'user_watchlists' and policyname = 'user_watchlists_select'
  ) then
    create policy "user_watchlists_select" on api.user_watchlists
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'api' and tablename = 'user_watchlists' and policyname = 'user_watchlists_modify'
  ) then
    create policy "user_watchlists_modify" on api.user_watchlists
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'api' and tablename = 'user_watchlists' and policyname = 'user_watchlists_update'
  ) then
    create policy "user_watchlists_update" on api.user_watchlists
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'api' and tablename = 'user_watchlists' and policyname = 'user_watchlists_delete'
  ) then
    create policy "user_watchlists_delete" on api.user_watchlists
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- Grants: follow existing pattern (authenticated via RLS).
grant select, insert, update, delete on api.user_watchlists to authenticated;

commit;

