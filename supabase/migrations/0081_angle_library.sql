begin;

set local search_path = public, extensions, api;

-- --------------------------------------------
-- Angle library (Closer+): save + reuse + A/B variants
-- - Workspace-scoped, RLS via api.is_workspace_member()
-- - No sending side effects; stores copy and metadata only
-- - Idempotent and safe to re-run
-- --------------------------------------------

create extension if not exists pgcrypto;

create table if not exists api.angle_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  title text not null,
  context text null,
  tags text[] not null default '{}'::text[],
  source text null, -- e.g. 'report', 'pitch', 'outreach_variant'
  source_ref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_angle_sets_updated_at') then
    create trigger trg_angle_sets_updated_at
    before update on api.angle_sets
    for each row execute function api.set_updated_at();
  end if;
exception when undefined_function then
  if not exists (select 1 from pg_trigger where tgname = 'trg_angle_sets_updated_at') then
    create trigger trg_angle_sets_updated_at
    before update on api.angle_sets
    for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists angle_sets_workspace_created_idx on api.angle_sets (workspace_id, created_at desc);
create index if not exists angle_sets_workspace_title_idx on api.angle_sets (workspace_id, lower(title));

alter table api.angle_sets enable row level security;

drop policy if exists angle_sets_select on api.angle_sets;
create policy angle_sets_select on api.angle_sets
for select using (api.is_workspace_member(workspace_id));

drop policy if exists angle_sets_insert on api.angle_sets;
create policy angle_sets_insert on api.angle_sets
for insert with check (api.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists angle_sets_update on api.angle_sets;
create policy angle_sets_update on api.angle_sets
for update using (api.is_workspace_member(workspace_id))
with check (api.is_workspace_member(workspace_id));

drop policy if exists angle_sets_delete_admin_only on api.angle_sets;
create policy angle_sets_delete_admin_only on api.angle_sets
for delete using (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

create table if not exists api.angle_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  angle_set_id uuid not null references api.angle_sets(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  label text not null, -- e.g. 'A', 'B', 'LinkedIn DM', 'Call opener'
  channel text null, -- e.g. 'email', 'linkedin_dm', 'call_opener'
  angle text not null,
  opener text not null,
  why_now_bullets text[] not null default '{}'::text[],
  limitations text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_angle_variants_updated_at') then
    create trigger trg_angle_variants_updated_at
    before update on api.angle_variants
    for each row execute function api.set_updated_at();
  end if;
exception when undefined_function then
  if not exists (select 1 from pg_trigger where tgname = 'trg_angle_variants_updated_at') then
    create trigger trg_angle_variants_updated_at
    before update on api.angle_variants
    for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists angle_variants_set_created_idx on api.angle_variants (angle_set_id, created_at desc);
create index if not exists angle_variants_workspace_status_idx on api.angle_variants (workspace_id, status, created_at desc);

alter table api.angle_variants enable row level security;

drop policy if exists angle_variants_select on api.angle_variants;
create policy angle_variants_select on api.angle_variants
for select using (api.is_workspace_member(workspace_id));

drop policy if exists angle_variants_insert on api.angle_variants;
create policy angle_variants_insert on api.angle_variants
for insert with check (api.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists angle_variants_update on api.angle_variants;
create policy angle_variants_update on api.angle_variants
for update using (api.is_workspace_member(workspace_id))
with check (api.is_workspace_member(workspace_id));

drop policy if exists angle_variants_delete_admin_only on api.angle_variants;
create policy angle_variants_delete_admin_only on api.angle_variants
for delete using (api.has_workspace_role(workspace_id, array['owner','admin','manager']));

grant select, insert, update, delete on api.angle_sets, api.angle_variants to authenticated;

notify pgrst, 'reload schema';
commit;

