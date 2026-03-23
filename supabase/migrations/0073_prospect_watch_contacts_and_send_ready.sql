begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- Contact workflow layer: prospect -> contact candidates -> recipient review -> send-ready approval.
-- Review-first. No external sending is performed by DB objects.

create table if not exists api.prospect_watch_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  prospect_id uuid not null references api.prospect_watch_prospects(id) on delete cascade,

  full_name text not null,
  first_name text null,
  last_name text null,
  title text null,
  linkedin_url text null,

  email text null,
  email_status text not null check (email_status in ('unknown','candidate','verified','invalid','manually_confirmed')) default 'unknown',

  source_type text not null check (source_type in ('manual','csv','provider','pattern')) default 'manual',
  source_url text null,
  confidence_score int not null default 50 check (confidence_score >= 0 and confidence_score <= 100),

  selected_for_outreach boolean not null default false,

  reviewer_notes text null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dedupe contacts by email within a workspace (if email present).
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'pwc_workspace_email_uq'
  ) then
    create unique index pwc_workspace_email_uq on api.prospect_watch_contacts (workspace_id, lower(email))
      where email is not null and length(trim(email)) > 0;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prospect_watch_contacts_updated_at') then
    create trigger trg_prospect_watch_contacts_updated_at
    before update on api.prospect_watch_contacts
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Only one selected contact per prospect.
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'pwc_selected_contact_uq'
  ) then
    create unique index pwc_selected_contact_uq
      on api.prospect_watch_contacts (prospect_id)
      where selected_for_outreach = true;
  end if;
end $$;

create index if not exists pwc_workspace_prospect_idx on api.prospect_watch_contacts (workspace_id, prospect_id, created_at desc);
create index if not exists pwc_workspace_email_idx on api.prospect_watch_contacts (workspace_id, lower(coalesce(email,'')));

-- Ensure selected contact flips are atomic and not racey.
-- This helper clears other selections for the same prospect.
create or replace function api.prospect_watch_select_contact(p_contact_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_workspace_id uuid;
  v_prospect_id uuid;
begin
  -- Resolve workspace + prospect for the contact (must exist).
  select c.workspace_id, c.prospect_id
    into v_workspace_id, v_prospect_id
  from api.prospect_watch_contacts c
  where c.id = p_contact_id;

  if v_workspace_id is null or v_prospect_id is null then
    raise exception 'contact_not_found';
  end if;

  -- Authorization: caller must be privileged in the workspace.
  if not exists (
    select 1
    from api.workspace_members wm
    where wm.workspace_id = v_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  ) then
    raise exception 'forbidden';
  end if;

  update api.prospect_watch_contacts
    set selected_for_outreach = false
  where prospect_id = v_prospect_id
    and selected_for_outreach = true
    and id <> p_contact_id;

  update api.prospect_watch_contacts
    set selected_for_outreach = true,
        reviewed_at = coalesce(reviewed_at, now()),
        reviewed_by = coalesce(reviewed_by, auth.uid())
  where id = p_contact_id;
end;
$$;

revoke all on function api.prospect_watch_select_contact(uuid) from public;
grant execute on function api.prospect_watch_select_contact(uuid) to authenticated;

alter table api.prospect_watch_contacts enable row level security;

drop policy if exists pwc_rw on api.prospect_watch_contacts;
create policy pwc_rw
on api.prospect_watch_contacts
for all
to authenticated
using (
  exists (
    select 1
    from api.workspace_members wm
    where wm.workspace_id = prospect_watch_contacts.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
)
with check (
  exists (
    select 1
    from api.workspace_members wm
    where wm.workspace_id = prospect_watch_contacts.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
);

grant select, insert, update, delete on api.prospect_watch_contacts to authenticated;

-- Send-ready approval state is tracked on the outreach draft rows.
alter table api.prospect_watch_outreach_drafts
  add column if not exists contact_id uuid null references api.prospect_watch_contacts(id) on delete set null,
  add column if not exists recipient_reviewed boolean not null default false,
  add column if not exists recipient_reviewed_at timestamptz null,
  add column if not exists recipient_reviewed_by uuid null references auth.users(id) on delete set null,
  add column if not exists send_ready boolean not null default false,
  add column if not exists send_ready_at timestamptz null,
  add column if not exists send_ready_by uuid null references auth.users(id) on delete set null;

create index if not exists pwod_contact_idx on api.prospect_watch_outreach_drafts (contact_id);
create index if not exists pwod_workspace_send_ready_idx on api.prospect_watch_outreach_drafts (workspace_id, send_ready, updated_at desc);

notify pgrst, 'reload schema';
commit;

