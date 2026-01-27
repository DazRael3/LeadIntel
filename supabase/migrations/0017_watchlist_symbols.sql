begin;

-- Per-user market watchlist symbols (stocks + crypto)
create table if not exists api.watchlist_symbols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references api.users(id) on delete cascade,
  symbol text not null,
  instrument_type text not null check (instrument_type in ('stock','crypto')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent duplicate symbols per user/type.
create unique index if not exists watchlist_symbols_user_symbol_type_uq
  on api.watchlist_symbols(user_id, symbol, instrument_type);

-- Sorting index for UI ordering.
create index if not exists watchlist_symbols_user_position_idx
  on api.watchlist_symbols(user_id, position);

-- Keep updated_at current (reuse shared helper from 0001_init_api_schema.sql).
drop trigger if exists trg_watchlist_symbols_updated_at on api.watchlist_symbols;
create trigger trg_watchlist_symbols_updated_at
before update on api.watchlist_symbols
for each row execute function public.set_updated_at();

alter table api.watchlist_symbols enable row level security;

drop policy if exists "watchlist_symbols_select_own" on api.watchlist_symbols;
create policy "watchlist_symbols_select_own"
on api.watchlist_symbols for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "watchlist_symbols_insert_own" on api.watchlist_symbols;
create policy "watchlist_symbols_insert_own"
on api.watchlist_symbols for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "watchlist_symbols_update_own" on api.watchlist_symbols;
create policy "watchlist_symbols_update_own"
on api.watchlist_symbols for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "watchlist_symbols_delete_own" on api.watchlist_symbols;
create policy "watchlist_symbols_delete_own"
on api.watchlist_symbols for delete
to authenticated
using (user_id = auth.uid());

commit;

