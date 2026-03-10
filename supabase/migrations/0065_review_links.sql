begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- Review links: short-lived signed tokens for external read-only review.
-- Stored server-side for revocation + auditability; token itself contains only (id, exp, signature).
create table if not exists api.review_links (
  id uuid primary key default gen_random_uuid(),
  source_workspace_id uuid not null references api.workspaces(id) on delete cascade,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  revoked_by uuid null references auth.users(id) on delete set null,
  last_used_at timestamptz null,
  use_count int not null default 0
);

alter table api.review_links enable row level security;

create index if not exists review_links_source_workspace_idx on api.review_links (source_workspace_id, created_at desc);
create index if not exists review_links_expires_idx on api.review_links (expires_at);

drop policy if exists review_links_select_privileged on api.review_links;
create policy review_links_select_privileged
on api.review_links
for select
using (api.has_workspace_role(source_workspace_id, array['owner','admin','manager']));

drop policy if exists review_links_insert_privileged on api.review_links;
create policy review_links_insert_privileged
on api.review_links
for insert
with check (api.has_workspace_role(source_workspace_id, array['owner','admin','manager']) and created_by = auth.uid());

drop policy if exists review_links_update_privileged on api.review_links;
create policy review_links_update_privileged
on api.review_links
for update
using (api.has_workspace_role(source_workspace_id, array['owner','admin','manager']))
with check (api.has_workspace_role(source_workspace_id, array['owner','admin','manager']));

drop policy if exists review_links_delete_privileged on api.review_links;
create policy review_links_delete_privileged
on api.review_links
for delete
using (api.has_workspace_role(source_workspace_id, array['owner','admin','manager']));

notify pgrst, 'reload schema';
commit;

