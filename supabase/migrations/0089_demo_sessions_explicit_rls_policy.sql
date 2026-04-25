begin;

set local search_path = public, extensions, api;

-- demo_sessions is intended for server-side/admin workflows only.
-- Keep explicit deny policy for authenticated users so RLS posture is unambiguous.
alter table api.demo_sessions enable row level security;

drop policy if exists demo_sessions_no_access on api.demo_sessions;
create policy demo_sessions_no_access on api.demo_sessions
  for all to authenticated
  using (false)
  with check (false);

notify pgrst, 'reload schema';
commit;
