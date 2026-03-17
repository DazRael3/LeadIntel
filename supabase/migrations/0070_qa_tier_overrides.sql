begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- Internal QA tier overrides:
-- - Used only for internal/test accounts to simulate tiers without Stripe/billing mutation.
-- - Enforced by server-side allowlists; table is not meant for direct client access.
create table if not exists api.qa_tier_overrides (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  override_tier text not null check (override_tier in ('starter','closer','closer_plus','team')),
  expires_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users(id) on delete set null,
  note text null,
  unique (target_user_id)
);

alter table api.qa_tier_overrides enable row level security;

create index if not exists qa_tier_overrides_target_idx on api.qa_tier_overrides (target_user_id);
create index if not exists qa_tier_overrides_active_idx on api.qa_tier_overrides (revoked_at, expires_at);

-- No client policies by default. Access is via server routes using service role.

notify pgrst, 'reload schema';
commit;

