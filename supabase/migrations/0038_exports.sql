begin;

create table if not exists api.export_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  type text not null check (type in ('accounts','signals','templates','pitches')),
  status text not null check (status in ('pending','ready','failed')) default 'pending',
  file_path text null,
  error text null,
  created_at timestamptz not null default now(),
  ready_at timestamptz null
);

alter table api.export_jobs enable row level security;

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'export_jobs_workspace_id_created_at_idx') then
    create index export_jobs_workspace_id_created_at_idx on api.export_jobs (workspace_id, created_at desc);
  end if;
end $$;

-- RLS:
-- - Members can read jobs in their workspace
-- - Only owner/admin can create jobs
-- - Updates are server-side only (service role), but owner/admin may update their own rows if needed
drop policy if exists export_jobs_select on api.export_jobs;
create policy export_jobs_select
on api.export_jobs
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists export_jobs_insert_admin_only on api.export_jobs;
create policy export_jobs_insert_admin_only
on api.export_jobs
for insert
with check (api.has_workspace_role(workspace_id, array['owner','admin']) and created_by = auth.uid());

drop policy if exists export_jobs_update_admin_only on api.export_jobs;
create policy export_jobs_update_admin_only
on api.export_jobs
for update
using (api.has_workspace_role(workspace_id, array['owner','admin']))
with check (api.has_workspace_role(workspace_id, array['owner','admin']));

notify pgrst, 'reload schema';
commit;

