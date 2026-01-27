begin;

-- App-level trial scaffolding (no Stripe changes).
alter table api.users
  add column if not exists trial_starts_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

commit;

