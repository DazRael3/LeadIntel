begin;

-- Team governance primitives live in the `api` schema.
-- RLS is enforced for all tables; elevated operations use role checks.

-- Workspaces
create table if not exists api.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table api.workspaces enable row level security;

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'workspaces_owner_user_id_idx') then
    create index workspaces_owner_user_id_idx on api.workspaces (owner_user_id);
  end if;
end $$;

-- Workspace members
create table if not exists api.workspace_members (
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table api.workspace_members enable row level security;

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'workspace_members_user_id_idx') then
    create index workspace_members_user_id_idx on api.workspace_members (user_id);
  end if;
end $$;

-- Helper: membership + role checks (declare after tables exist)
create or replace function api.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from api.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function api.workspace_role(p_workspace_id uuid)
returns text
language sql
stable
as $$
  select m.role
  from api.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = auth.uid()
  limit 1;
$$;

create or replace function api.has_workspace_role(p_workspace_id uuid, p_roles text[])
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from api.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.role = any(p_roles)
  );
$$;

-- Helper: invite token hashing (sha256 hex)
create or replace function api.hash_invite_token(p_token text)
returns text
language sql
stable
as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Workspace invites
create table if not exists api.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','member')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  accepted_by uuid null references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table api.workspace_invites enable row level security;

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'workspace_invites_workspace_id_idx') then
    create index workspace_invites_workspace_id_idx on api.workspace_invites (workspace_id);
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'workspace_invites_email_idx') then
    create index workspace_invites_email_idx on api.workspace_invites (lower(email));
  end if;
end $$;

-- Template sets
create table if not exists api.template_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  name text not null,
  description text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table api.template_sets enable row level security;

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'template_sets_workspace_id_idx') then
    create index template_sets_workspace_id_idx on api.template_sets (workspace_id);
  end if;
end $$;

-- Templates (workspace-governed)
create table if not exists api.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  set_id uuid null references api.template_sets(id) on delete set null,
  slug text not null,
  title text not null,
  channel text not null check (channel in ('email','linkedin_dm','call_opener')),
  trigger text not null,
  persona text not null,
  length text not null,
  subject text null,
  body text not null,
  tokens text[] not null default '{}'::text[],
  status text not null check (status in ('draft','approved')) default 'draft',
  created_by uuid not null references auth.users(id),
  approved_by uuid null references auth.users(id),
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

alter table api.templates enable row level security;

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'templates_workspace_id_idx') then
    create index templates_workspace_id_idx on api.templates (workspace_id);
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'templates_set_id_idx') then
    create index templates_set_id_idx on api.templates (set_id);
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'templates_status_idx') then
    create index templates_status_idx on api.templates (status);
  end if;
end $$;

-- Audit logs
create table if not exists api.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id uuid null,
  meta jsonb not null default '{}'::jsonb,
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

alter table api.audit_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'audit_logs_workspace_id_created_at_idx') then
    create index audit_logs_workspace_id_created_at_idx on api.audit_logs (workspace_id, created_at desc);
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'api' and c.relname = 'audit_logs_actor_user_id_idx') then
    create index audit_logs_actor_user_id_idx on api.audit_logs (actor_user_id);
  end if;
end $$;

-- Workspace default template set
alter table api.workspaces
  add column if not exists default_template_set_id uuid null references api.template_sets(id) on delete set null;

-- Invite accept RPC: validates token + matching email from JWT claims.
create or replace function api.accept_workspace_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = api, public
as $$
declare
  v_user_id uuid;
  v_email text;
  v_hash text;
  v_inv api.workspace_invites%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    raise exception 'Missing session email';
  end if;

  v_hash := api.hash_invite_token(p_token);

  select *
    into v_inv
    from api.workspace_invites i
   where i.token_hash = v_hash
     and i.accepted_at is null
     and i.expires_at > now()
     and lower(i.email) = v_email
   limit 1;

  if not found then
    raise exception 'Invalid or expired invite';
  end if;

  insert into api.workspace_members (workspace_id, user_id, role)
  values (v_inv.workspace_id, v_user_id, v_inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update api.workspace_invites
     set accepted_at = now(),
         accepted_by = v_user_id
   where id = v_inv.id;

  return v_inv.workspace_id;
end;
$$;

revoke all on function api.accept_workspace_invite(text) from public;
grant execute on function api.accept_workspace_invite(text) to authenticated;

-- RLS policies

-- workspaces: members can select; only owner/admin can update; only owner can delete.
drop policy if exists workspaces_select on api.workspaces;
create policy workspaces_select
on api.workspaces
for select
using (api.is_workspace_member(id));

drop policy if exists workspaces_insert_owner_only on api.workspaces;
create policy workspaces_insert_owner_only
on api.workspaces
for insert
with check (owner_user_id = auth.uid());

drop policy if exists workspaces_update_admin_only on api.workspaces;
create policy workspaces_update_admin_only
on api.workspaces
for update
using (api.has_workspace_role(id, array['owner','admin']))
with check (api.has_workspace_role(id, array['owner','admin']));

drop policy if exists workspaces_delete_owner_only on api.workspaces;
create policy workspaces_delete_owner_only
on api.workspaces
for delete
using (api.has_workspace_role(id, array['owner']));

-- workspace_members: members can select; only owner/admin can insert/delete/update roles.
drop policy if exists workspace_members_select on api.workspace_members;
create policy workspace_members_select
on api.workspace_members
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists workspace_members_insert_admin_only on api.workspace_members;
create policy workspace_members_insert_admin_only
on api.workspace_members
for insert
with check (
  api.has_workspace_role(workspace_id, array['owner','admin'])
  or (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from api.workspaces w
      where w.id = workspace_id
        and w.owner_user_id = auth.uid()
    )
  )
);

drop policy if exists workspace_members_update_admin_only on api.workspace_members;
create policy workspace_members_update_admin_only
on api.workspace_members
for update
using (api.has_workspace_role(workspace_id, array['owner','admin']))
with check (api.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists workspace_members_delete_admin_only on api.workspace_members;
create policy workspace_members_delete_admin_only
on api.workspace_members
for delete
using (api.has_workspace_role(workspace_id, array['owner','admin']));

-- workspace_invites: only owner/admin can create/select/update/delete.
drop policy if exists workspace_invites_select_admin_only on api.workspace_invites;
create policy workspace_invites_select_admin_only
on api.workspace_invites
for select
using (api.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists workspace_invites_insert_admin_only on api.workspace_invites;
create policy workspace_invites_insert_admin_only
on api.workspace_invites
for insert
with check (api.has_workspace_role(workspace_id, array['owner','admin']) and created_by = auth.uid());

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

-- template_sets: members can read; only owner/admin can create/edit/delete.
drop policy if exists template_sets_select on api.template_sets;
create policy template_sets_select
on api.template_sets
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists template_sets_insert_admin_only on api.template_sets;
create policy template_sets_insert_admin_only
on api.template_sets
for insert
with check (api.has_workspace_role(workspace_id, array['owner','admin']) and created_by = auth.uid());

drop policy if exists template_sets_update_admin_only on api.template_sets;
create policy template_sets_update_admin_only
on api.template_sets
for update
using (api.has_workspace_role(workspace_id, array['owner','admin']))
with check (api.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists template_sets_delete_admin_only on api.template_sets;
create policy template_sets_delete_admin_only
on api.template_sets
for delete
using (api.has_workspace_role(workspace_id, array['owner','admin']));

-- templates: members can read approved; owner/admin can read all + create/edit; only owner/admin can approve.
drop policy if exists templates_select on api.templates;
create policy templates_select
on api.templates
for select
using (
  api.is_workspace_member(workspace_id)
  and (
    status = 'approved'
    or api.has_workspace_role(workspace_id, array['owner','admin'])
  )
);

drop policy if exists templates_insert_admin_only on api.templates;
create policy templates_insert_admin_only
on api.templates
for insert
with check (api.has_workspace_role(workspace_id, array['owner','admin']) and created_by = auth.uid());

drop policy if exists templates_update_admin_only on api.templates;
create policy templates_update_admin_only
on api.templates
for update
using (api.has_workspace_role(workspace_id, array['owner','admin']))
with check (api.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists templates_delete_admin_only on api.templates;
create policy templates_delete_admin_only
on api.templates
for delete
using (api.has_workspace_role(workspace_id, array['owner','admin']));

-- audit_logs: members can read; owner/admin can insert but must set actor_user_id to auth.uid().
drop policy if exists audit_logs_select on api.audit_logs;
create policy audit_logs_select
on api.audit_logs
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists audit_logs_insert_admin_only on api.audit_logs;
create policy audit_logs_insert_admin_only
on api.audit_logs
for insert
with check (
  api.has_workspace_role(workspace_id, array['owner','admin'])
  and actor_user_id = auth.uid()
);

notify pgrst, 'reload schema';
commit;

