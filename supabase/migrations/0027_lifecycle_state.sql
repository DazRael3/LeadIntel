-- 0027_lifecycle_state.sql
-- Lifecycle state for welcome/nudges/recap/winback (idempotent).

begin;

create table if not exists api.lifecycle_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  signup_at timestamptz not null default now(),
  last_active_at timestamptz,
  welcome_sent_at timestamptz,
  nudge_accounts_sent_at timestamptz,
  nudge_pitch_sent_at timestamptz,
  value_recap_sent_at timestamptz,
  winback_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger (reuses public.set_updated_at from 0001)
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_lifecycle_state_updated_at'
  ) then
    create trigger trg_lifecycle_state_updated_at
    before update on api.lifecycle_state
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table api.lifecycle_state enable row level security;

-- Policies: users can read/write their own row
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='lifecycle_state' and policyname='lifecycle_state_select_own') then
    create policy "lifecycle_state_select_own"
    on api.lifecycle_state for select
    to authenticated
    using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='api' and tablename='lifecycle_state' and policyname='lifecycle_state_insert_own') then
    create policy "lifecycle_state_insert_own"
    on api.lifecycle_state for insert
    to authenticated
    with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='api' and tablename='lifecycle_state' and policyname='lifecycle_state_update_own') then
    create policy "lifecycle_state_update_own"
    on api.lifecycle_state for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on api.lifecycle_state to authenticated;

notify pgrst, 'reload schema';

commit;

