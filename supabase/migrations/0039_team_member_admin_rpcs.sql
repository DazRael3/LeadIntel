begin;

-- Admin RPCs for enforcing invariants that are awkward in pure RLS:
-- - single owner
-- - atomic ownership transfer

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

  -- Set new owner role first to ensure invariants even if client retries.
  update api.workspace_members
     set role = 'owner'
   where workspace_id = p_workspace_id
     and user_id = p_new_owner_user_id;

  -- Demote previous owner to admin (preserve admin visibility).
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

  if p_role not in ('owner','admin','member') then
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

  -- Admins can change roles between admin/member, but cannot touch the owner.
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

create or replace function api.remove_workspace_member(p_workspace_id uuid, p_user_id uuid)
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

  if v_actor_role not in ('owner','admin') then
    raise exception 'Access restricted';
  end if;

  if exists (
    select 1 from api.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = p_user_id and m.role = 'owner'
  ) then
    raise exception 'Access restricted';
  end if;

  delete from api.workspace_members
   where workspace_id = p_workspace_id
     and user_id = p_user_id;
end;
$$;

revoke all on function api.remove_workspace_member(uuid, uuid) from public;
grant execute on function api.remove_workspace_member(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;

