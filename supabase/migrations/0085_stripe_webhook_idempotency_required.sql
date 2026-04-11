begin;

set local search_path = public, extensions, api;

-- Stripe webhook event idempotency table (required dependency for webhook processing).
create table if not exists api.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text unique,
  type text,
  livemode boolean,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  processed_at timestamptz,
  error text
);

create index if not exists stripe_webhook_events_received_at_idx on api.stripe_webhook_events (received_at desc);

alter table api.stripe_webhook_events enable row level security;

-- Keep locked down: webhook handler uses service role; authenticated users get no access.
drop policy if exists stripe_events_no_access on api.stripe_webhook_events;
create policy stripe_events_no_access on api.stripe_webhook_events
  for all to authenticated
  using (false)
  with check (false);

notify pgrst, 'reload schema';
commit;
