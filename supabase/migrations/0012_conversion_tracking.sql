begin;

create table if not exists api.conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references api.leads(id) on delete set null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  source text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversions_user_id_idx on api.conversions(user_id);
create index if not exists conversions_occurred_at_idx on api.conversions(occurred_at desc);

alter table api.conversions enable row level security;

drop policy if exists "conversions_rw_own" on api.conversions;
create policy "conversions_rw_own" on api.conversions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on api.conversions to authenticated;

commit;

