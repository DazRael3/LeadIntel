begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- Lightweight feedback capture (privacy-safe, minimal operational cost).
-- Notes:
-- - Stored in `api` schema for consistency with other app tables.
-- - RLS: inserts allowed for anon/auth; reads are intentionally restricted.
create table if not exists api.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  route text not null,
  surface text not null,
  sentiment text not null check (sentiment in ('up','down','note')),
  message text null,
  device_class text not null check (device_class in ('mobile','desktop','unknown')),
  viewport_w int null,
  viewport_h int null,
  meta jsonb not null default '{}'::jsonb
);

alter table api.feedback enable row level security;

create index if not exists feedback_created_at_idx on api.feedback (created_at desc);
create index if not exists feedback_route_idx on api.feedback (route);

-- Insert is allowed for:
-- - anonymous users with user_id null
-- - authenticated users with user_id = auth.uid() (or user_id null if they prefer)
drop policy if exists feedback_insert on api.feedback;
create policy feedback_insert
on api.feedback
for insert
with check (
  (user_id is null) or (auth.uid() is not null and user_id = auth.uid())
);

-- Reads are intentionally restricted by default (no select policy).
-- Internal review should be done via service role or SQL editor.

notify pgrst, 'reload schema';
commit;

