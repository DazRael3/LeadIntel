begin;

set local search_path = public, extensions, api;

-- Outbound workflow event log (review-first). This is a lightweight, integration-friendly ledger.
-- It records approvals, send-ready transitions, exports, and downstream delivery outcomes (when available).
create table if not exists api.outbound_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,

  subject_type text not null check (subject_type in ('outreach_draft','content_draft')),
  subject_id uuid not null,

  event_type text not null check (
    event_type in (
      'approved',
      'approval_revoked',
      'recipient_reviewed',
      'send_ready_set',
      'send_ready_unset',
      'exported',
      'sent',
      'delivered',
      'bounced',
      'failed',
      'replied',
      'posted'
    )
  ),

  channel text null,
  provider text null,
  provider_message_id text null,
  meta jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='api' and c.relname='outbound_events_workspace_occurred_idx'
  ) then
    create index outbound_events_workspace_occurred_idx on api.outbound_events (workspace_id, occurred_at desc);
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='api' and c.relname='outbound_events_subject_idx'
  ) then
    create index outbound_events_subject_idx on api.outbound_events (workspace_id, subject_type, subject_id, occurred_at desc);
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='api' and c.relname='outbound_events_provider_message_idx'
  ) then
    create index outbound_events_provider_message_idx on api.outbound_events (provider, provider_message_id);
  end if;
end $$;

alter table api.outbound_events enable row level security;

drop policy if exists outbound_events_select on api.outbound_events;
create policy outbound_events_select
on api.outbound_events
for select
to authenticated
using (api.is_workspace_member(workspace_id));

drop policy if exists outbound_events_insert on api.outbound_events;
create policy outbound_events_insert
on api.outbound_events
for insert
to authenticated
with check (
  api.has_workspace_role(workspace_id, array['owner','admin','manager'])
  and (actor_user_id is null or actor_user_id = auth.uid())
);

-- Updates/deletes are disallowed; treat as an append-only ledger.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='outbound_events' and policyname='outbound_events_no_update') then
    create policy "outbound_events_no_update" on api.outbound_events
    for update to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='outbound_events' and policyname='outbound_events_no_delete') then
    create policy "outbound_events_no_delete" on api.outbound_events
    for delete to authenticated using (false);
  end if;
end $$;

grant select, insert on api.outbound_events to authenticated;

notify pgrst, 'reload schema';
commit;

