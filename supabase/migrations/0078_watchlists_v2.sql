begin;

set local search_path = public, extensions, api;

-- --------------------------------------------
-- Watchlists v2 (Closer): multi-list + item notes + reminders
-- - Workspace-scoped (for Team/org use), but still usable for solo users via personal workspace.
-- - Preserves legacy api.watchlist table by migrating rows into a default watchlist per workspace.
-- - Idempotent and safe to re-run.
-- --------------------------------------------

create extension if not exists pgcrypto;

-- 1) Watchlists container
create table if not exists api.watchlists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  name text not null,
  description text null,
  is_default boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_watchlists_updated_at') then
    create trigger trg_watchlists_updated_at
    before update on api.watchlists
    for each row execute function api.set_updated_at();
  end if;
exception when undefined_function then
  -- Older environments may not have api.set_updated_at; fall back to public.set_updated_at.
  if not exists (select 1 from pg_trigger where tgname = 'trg_watchlists_updated_at') then
    create trigger trg_watchlists_updated_at
    before update on api.watchlists
    for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists watchlists_workspace_created_idx on api.watchlists (workspace_id, created_at desc);
create unique index if not exists watchlists_default_unique on api.watchlists (workspace_id) where is_default = true;
create unique index if not exists watchlists_workspace_lower_name_uq on api.watchlists (workspace_id, lower(name));

alter table api.watchlists enable row level security;

drop policy if exists watchlists_select on api.watchlists;
create policy watchlists_select
on api.watchlists
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists watchlists_write on api.watchlists;
create policy watchlists_write
on api.watchlists
for insert
with check (api.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists watchlists_update on api.watchlists;
create policy watchlists_update
on api.watchlists
for update
using (api.is_workspace_member(workspace_id))
with check (api.is_workspace_member(workspace_id));

drop policy if exists watchlists_delete_admin_only on api.watchlists;
create policy watchlists_delete_admin_only
on api.watchlists
for delete
using (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

-- 2) Watchlist items
create table if not exists api.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  watchlist_id uuid not null references api.watchlists(id) on delete cascade,
  lead_id uuid not null references api.leads(id) on delete cascade,
  added_by uuid null references auth.users(id) on delete set null,
  note text null,
  reminder_at timestamptz null,
  reminder_status text not null default 'none' check (reminder_status in ('none','scheduled','shown','dismissed','completed')),
  reminder_last_shown_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watchlist_id, lead_id)
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_watchlist_items_updated_at') then
    create trigger trg_watchlist_items_updated_at
    before update on api.watchlist_items
    for each row execute function api.set_updated_at();
  end if;
exception when undefined_function then
  if not exists (select 1 from pg_trigger where tgname = 'trg_watchlist_items_updated_at') then
    create trigger trg_watchlist_items_updated_at
    before update on api.watchlist_items
    for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists watchlist_items_watchlist_created_idx on api.watchlist_items (watchlist_id, created_at desc);
create index if not exists watchlist_items_workspace_reminders_idx on api.watchlist_items (workspace_id, reminder_status, reminder_at asc);
create index if not exists watchlist_items_lead_idx on api.watchlist_items (workspace_id, lead_id);

alter table api.watchlist_items enable row level security;

drop policy if exists watchlist_items_select on api.watchlist_items;
create policy watchlist_items_select
on api.watchlist_items
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists watchlist_items_insert on api.watchlist_items;
create policy watchlist_items_insert
on api.watchlist_items
for insert
with check (api.is_workspace_member(workspace_id) and added_by = auth.uid());

drop policy if exists watchlist_items_update on api.watchlist_items;
create policy watchlist_items_update
on api.watchlist_items
for update
using (api.is_workspace_member(workspace_id))
with check (api.is_workspace_member(workspace_id));

drop policy if exists watchlist_items_delete on api.watchlist_items;
create policy watchlist_items_delete
on api.watchlist_items
for delete
using (api.is_workspace_member(workspace_id));

-- 3) Backfill: create default watchlists per workspace (idempotent) and migrate legacy api.watchlist rows.
-- Legacy table is per-user (not workspace). We map to the user's current/owned workspace.
do $$
declare
  r record;
  v_workspace_id uuid;
  v_watchlist_id uuid;
begin
  -- Ensure every workspace has a default watchlist.
  for r in select w.id as workspace_id, w.owner_user_id as owner_user_id from api.workspaces w loop
    if not exists (select 1 from api.watchlists wl where wl.workspace_id = r.workspace_id and wl.is_default = true) then
      insert into api.watchlists (workspace_id, name, description, is_default, created_by)
      values (r.workspace_id, 'Default', 'Primary watchlist for this workspace.', true, r.owner_user_id)
      on conflict do nothing;
    end if;
  end loop;

  -- Migrate legacy per-user watchlist rows into the default watchlist for the user's current workspace if possible.
  -- If the legacy table doesn't exist, skip.
  begin
    for r in
      select w.user_id, w.company_domain, w.company_name, w.company_url, w.notes, w.created_at
      from api.watchlist w
    loop
      -- Resolve workspace: prefer current_workspace_id; fall back to owned workspace.
      select u.current_workspace_id into v_workspace_id
      from api.users u
      where u.id = r.user_id
      limit 1;

      if v_workspace_id is null then
        select ws.id into v_workspace_id
        from api.workspaces ws
        where ws.owner_user_id = r.user_id
        order by ws.created_at asc
        limit 1;
      end if;

      if v_workspace_id is null then
        continue;
      end if;

      select wl.id into v_watchlist_id
      from api.watchlists wl
      where wl.workspace_id = v_workspace_id and wl.is_default = true
      limit 1;

      if v_watchlist_id is null then
        continue;
      end if;

      -- Ensure a lead exists for the domain (leads are user-scoped; tie to user_id).
      -- If company_url is missing, skip.
      if r.company_url is null then
        continue;
      end if;

      insert into api.leads (user_id, company_url, company_domain, company_name, ai_personalized_pitch, created_at, updated_at)
      values (r.user_id, r.company_url, r.company_domain, r.company_name, null, coalesce(r.created_at, now()), coalesce(r.created_at, now()))
      on conflict on constraint leads_user_domain_unique do update set
        company_url = excluded.company_url,
        company_name = coalesce(excluded.company_name, api.leads.company_name),
        updated_at = now();

      -- Resolve lead id for item link.
      insert into api.watchlist_items (workspace_id, watchlist_id, lead_id, added_by, note, reminder_status, created_at, updated_at)
      select v_workspace_id, v_watchlist_id, l.id, r.user_id, r.notes, 'none', coalesce(r.created_at, now()), now()
      from api.leads l
      where l.user_id = r.user_id
        and (
          (r.company_domain is not null and l.company_domain = r.company_domain)
          or (r.company_domain is null and l.company_url = r.company_url)
        )
      on conflict (watchlist_id, lead_id) do update set
        note = coalesce(excluded.note, api.watchlist_items.note),
        updated_at = now();
    end loop;
  exception when undefined_table then
    -- legacy table missing; skip
  end;
end $$;

grant select, insert, update, delete on api.watchlists, api.watchlist_items to authenticated;

notify pgrst, 'reload schema';
commit;

