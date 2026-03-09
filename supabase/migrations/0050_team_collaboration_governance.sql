begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- 1) Expand workspace role model (owner/admin/manager/rep/viewer)
do $$
declare
  c_name text;
begin
  select conname into c_name
    from pg_constraint
   where conrelid = 'api.workspace_members'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%role%'
     and pg_get_constraintdef(oid) ilike '%in%';

  if c_name is not null then
    execute format('alter table api.workspace_members drop constraint if exists %I', c_name);
  end if;
exception when undefined_table then
  -- ignore
end $$;

-- Migrate legacy role 'member' to 'rep' before adding the new constraint.
update api.workspace_members set role = 'rep' where role = 'member';

alter table api.workspace_members
  add constraint workspace_members_role_check check (role in ('owner','admin','manager','rep','viewer'));

do $$
declare
  c_name text;
begin
  select conname into c_name
    from pg_constraint
   where conrelid = 'api.workspace_invites'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%role%'
     and pg_get_constraintdef(oid) ilike '%in%';

  if c_name is not null then
    execute format('alter table api.workspace_invites drop constraint if exists %I', c_name);
  end if;
exception when undefined_table then
  -- ignore
end $$;

-- Migrate legacy invite role 'member' to 'rep' before adding the new constraint.
update api.workspace_invites set role = 'rep' where role = 'member';

alter table api.workspace_invites
  add constraint workspace_invites_role_check check (role in ('admin','manager','rep','viewer'));

-- 2) Workspace governance settings (minimal, actionable)
alter table api.workspaces
  add column if not exists require_handoff_approval boolean not null default false;

-- 3) Assignments on action queue items (workspace-scoped)
alter table api.action_queue_items
  add column if not exists assigned_to_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists assigned_by_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz null;

create index if not exists action_queue_items_workspace_assigned_idx
  on api.action_queue_items (workspace_id, assigned_to_user_id, status, created_at desc);

-- 4) Comment threads + comments (lightweight collaboration)
create table if not exists api.comment_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  thread_type text not null default 'general' check (thread_type in ('general','review_feedback','changes_requested','manager_note','handoff_note')),
  status text not null default 'open' check (status in ('open','resolved')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_by uuid null references auth.users(id),
  resolved_at timestamptz null
);

create index if not exists comment_threads_workspace_target_idx
  on api.comment_threads (workspace_id, target_type, target_id, created_at desc);
create index if not exists comment_threads_workspace_status_idx
  on api.comment_threads (workspace_id, status, created_at desc);

alter table api.comment_threads enable row level security;

create table if not exists api.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  thread_id uuid not null references api.comment_threads(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  body_text text not null check (char_length(body_text) <= 4000),
  reply_to_id uuid null references api.comments(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz null,
  deleted_at timestamptz null
);

create index if not exists comments_thread_created_idx on api.comments (thread_id, created_at asc);

alter table api.comments enable row level security;

-- 5) Approval requests (separate from template.status to avoid churn)
create table if not exists api.approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  status text not null default 'draft' check (status in ('draft','pending_review','changes_requested','approved','archived')),
  submitted_by uuid null references auth.users(id),
  submitted_at timestamptz null,
  reviewed_by uuid null references auth.users(id),
  reviewed_at timestamptz null,
  reviewer_user_id uuid null references auth.users(id),
  note text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_approval_requests_updated_at') then
    create trigger trg_approval_requests_updated_at
    before update on api.approval_requests
    for each row execute function api.set_updated_at();
  end if;
end $$;

create unique index if not exists approval_requests_unique_target on api.approval_requests (workspace_id, target_type, target_id);
create index if not exists approval_requests_workspace_status_idx on api.approval_requests (workspace_id, status, created_at desc);
create index if not exists approval_requests_workspace_reviewer_idx on api.approval_requests (workspace_id, reviewer_user_id, status, created_at desc);

alter table api.approval_requests enable row level security;

-- 6) In-app notifications (workspace-scoped, recipient-only read)
create table if not exists api.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  from_user_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  target_type text null,
  target_id uuid null,
  body text null,
  meta jsonb not null default '{}'::jsonb,
  dedupe_key text null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists notifications_to_user_unread_idx on api.notifications (to_user_id, read_at, created_at desc);
create unique index if not exists notifications_dedupe_unique on api.notifications (workspace_id, to_user_id, dedupe_key) where dedupe_key is not null;

alter table api.notifications enable row level security;

-- 7) Playbook standards (light governance for default shared assets)
create table if not exists api.playbook_standards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  channel text not null,
  trigger text not null,
  persona text not null,
  template_id uuid not null references api.templates(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, channel, trigger, persona)
);

alter table api.playbook_standards enable row level security;

-- RLS policies (members can read; privileged roles can manage)
drop policy if exists comment_threads_select on api.comment_threads;
create policy comment_threads_select on api.comment_threads
for select using (api.is_workspace_member(workspace_id));

drop policy if exists comment_threads_insert on api.comment_threads;
create policy comment_threads_insert on api.comment_threads
for insert with check (api.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists comment_threads_update on api.comment_threads;
create policy comment_threads_update on api.comment_threads
for update using (api.is_workspace_member(workspace_id))
with check (api.is_workspace_member(workspace_id));

drop policy if exists comments_select on api.comments;
create policy comments_select on api.comments
for select using (api.is_workspace_member(workspace_id));

drop policy if exists comments_insert on api.comments;
create policy comments_insert on api.comments
for insert with check (api.is_workspace_member(workspace_id) and author_user_id = auth.uid());

drop policy if exists comments_update on api.comments;
create policy comments_update on api.comments
for update using (author_user_id = auth.uid() and api.is_workspace_member(workspace_id))
with check (author_user_id = auth.uid() and api.is_workspace_member(workspace_id));

drop policy if exists approval_requests_select on api.approval_requests;
create policy approval_requests_select on api.approval_requests
for select using (api.is_workspace_member(workspace_id));

drop policy if exists approval_requests_write_admin_only on api.approval_requests;
create policy approval_requests_write_admin_only on api.approval_requests
for all to authenticated
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']))
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

drop policy if exists notifications_select on api.notifications;
create policy notifications_select on api.notifications
for select using (to_user_id = auth.uid());

drop policy if exists notifications_update on api.notifications;
create policy notifications_update on api.notifications
for update using (to_user_id = auth.uid())
with check (to_user_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='notifications' and policyname='notifications_no_insert') then
    create policy "notifications_no_insert" on api.notifications
    for insert to authenticated with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='notifications' and policyname='notifications_no_delete') then
    create policy "notifications_no_delete" on api.notifications
    for delete to authenticated using (false);
  end if;
end $$;

drop policy if exists playbook_standards_select on api.playbook_standards;
create policy playbook_standards_select on api.playbook_standards
for select using (api.is_workspace_member(workspace_id));

drop policy if exists playbook_standards_write_admin_only on api.playbook_standards;
create policy playbook_standards_write_admin_only on api.playbook_standards
for all to authenticated
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']))
with check (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

-- Update admin RPCs to accept expanded roles.
create or replace function api.set_workspace_member_role(p_workspace_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = api, public
as $$
declare
  v_actor uuid;
  v_actor_role text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select m.role
    into v_actor_role
    from api.workspace_members m
   where m.workspace_id = p_workspace_id
     and m.user_id = v_actor
   limit 1;

  if v_actor_role is null then
    raise exception 'Access restricted';
  end if;

  if p_role not in ('owner','admin','manager','rep','viewer') then
    raise exception 'Invalid role';
  end if;

  -- Only the current owner can assign the owner role.
  if p_role = 'owner' then
    if v_actor_role <> 'owner' then
      raise exception 'Access restricted';
    end if;
    perform api.transfer_workspace_ownership(p_workspace_id, p_user_id);
    return;
  end if;

  -- Admins (and owner) can change roles among non-owner roles; managers cannot change roles.
  if v_actor_role not in ('owner','admin') then
    raise exception 'Access restricted';
  end if;

  if exists (
    select 1 from api.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = p_user_id and m.role = 'owner'
  ) then
    raise exception 'Access restricted';
  end if;

  update api.workspace_members
     set role = p_role
   where workspace_id = p_workspace_id
     and user_id = p_user_id;
end;
$$;

revoke all on function api.set_workspace_member_role(uuid, uuid, text) from public;
grant execute on function api.set_workspace_member_role(uuid, uuid, text) to authenticated;

-- Ensure ownership transfer demotes previous owner to admin (not manager).
create or replace function api.transfer_workspace_ownership(p_workspace_id uuid, p_new_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = api, public
as $$
declare
  v_actor uuid;
  v_current_owner uuid;
  v_is_member boolean;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select w.owner_user_id
    into v_current_owner
    from api.workspaces w
   where w.id = p_workspace_id
   limit 1;

  if v_current_owner is null then
    raise exception 'Workspace not found';
  end if;

  if v_current_owner <> v_actor then
    raise exception 'Access restricted';
  end if;

  select exists(
    select 1
      from api.workspace_members m
     where m.workspace_id = p_workspace_id
       and m.user_id = p_new_owner_user_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'New owner must be a workspace member';
  end if;

  update api.workspace_members
     set role = 'owner'
   where workspace_id = p_workspace_id
     and user_id = p_new_owner_user_id;

  update api.workspace_members
     set role = 'admin'
   where workspace_id = p_workspace_id
     and user_id = v_current_owner
     and v_current_owner <> p_new_owner_user_id;

  update api.workspaces
     set owner_user_id = p_new_owner_user_id
   where id = p_workspace_id;
end;
$$;

revoke all on function api.transfer_workspace_ownership(uuid, uuid) from public;
grant execute on function api.transfer_workspace_ownership(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;

