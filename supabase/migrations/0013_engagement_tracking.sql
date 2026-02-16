begin;

create table if not exists api.email_engagement (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references api.leads(id) on delete set null,
  provider text not null default 'resend',
  provider_message_id text not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists email_engagement_provider_message_event_uq
  on api.email_engagement(provider, provider_message_id, event_type);

alter table api.email_engagement enable row level security;

drop policy if exists "email_engagement_rw_own" on api.email_engagement;
create policy "email_engagement_rw_own" on api.email_engagement
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on api.email_engagement to authenticated;

commit;

