begin;

set local search_path = public, extensions, api;

-- Align workspace_invites governance with expanded role model:
-- Managers can create and view invites, but only owner/admin can revoke.

drop policy if exists workspace_invites_select_admin_only on api.workspace_invites;
create policy workspace_invites_select_admin_only
on api.workspace_invites
for select
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists workspace_invites_insert_admin_only on api.workspace_invites;
create policy workspace_invites_insert_admin_only
on api.workspace_invites
for insert
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']) and created_by = auth.uid());

drop policy if exists workspace_invites_update_admin_only on api.workspace_invites;
create policy workspace_invites_update_admin_only
on api.workspace_invites
for update
using (api.has_workspace_role(workspace_id, array['owner','admin']))
with check (api.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists workspace_invites_delete_admin_only on api.workspace_invites;
create policy workspace_invites_delete_admin_only
on api.workspace_invites
for delete
using (api.has_workspace_role(workspace_id, array['owner','admin']));

notify pgrst, 'reload schema';
commit;

