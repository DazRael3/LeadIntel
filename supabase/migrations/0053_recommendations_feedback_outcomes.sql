begin;

set local search_path = public, extensions, api;

create table if not exists api.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('account','workspace')),
  target_id text not null,
  recommendation_type text not null,
  recommendation_version text not null,
  kind text not null,
  comment text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='api' and c.relname='recommendation_feedback_workspace_created_idx') then
    create index recommendation_feedback_workspace_created_idx on api.recommendation_feedback (workspace_id, created_at desc);
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='api' and c.relname='recommendation_feedback_target_idx') then
    create index recommendation_feedback_target_idx on api.recommendation_feedback (workspace_id, target_type, target_id);
  end if;
end $$;

alter table api.recommendation_feedback enable row level security;

drop policy if exists recommendation_feedback_select on api.recommendation_feedback;
create policy recommendation_feedback_select
on api.recommendation_feedback
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists recommendation_feedback_insert on api.recommendation_feedback;
create policy recommendation_feedback_insert
on api.recommendation_feedback
for insert
with check (api.is_workspace_member(workspace_id) and actor_user_id = auth.uid());

drop policy if exists recommendation_feedback_update_own on api.recommendation_feedback;
create policy recommendation_feedback_update_own
on api.recommendation_feedback
for update
using (api.is_workspace_member(workspace_id) and actor_user_id = auth.uid())
with check (api.is_workspace_member(workspace_id) and actor_user_id = auth.uid());

create table if not exists api.outcome_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid null references api.leads(id) on delete set null,
  outcome text not null,
  note text null,
  subject_type text null,
  subject_id text null,
  recommendation_version text null,
  meta jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='api' and c.relname='outcome_records_workspace_recorded_idx') then
    create index outcome_records_workspace_recorded_idx on api.outcome_records (workspace_id, recorded_at desc);
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='api' and c.relname='outcome_records_account_idx') then
    create index outcome_records_account_idx on api.outcome_records (workspace_id, account_id, recorded_at desc);
  end if;
end $$;

create trigger trg_outcome_records_updated_at
before update on api.outcome_records
for each row execute function public.set_updated_at();

alter table api.outcome_records enable row level security;

drop policy if exists outcome_records_select on api.outcome_records;
create policy outcome_records_select
on api.outcome_records
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists outcome_records_insert on api.outcome_records;
create policy outcome_records_insert
on api.outcome_records
for insert
with check (api.is_workspace_member(workspace_id) and actor_user_id = auth.uid());

drop policy if exists outcome_records_update_own_or_admin on api.outcome_records;
create policy outcome_records_update_own_or_admin
on api.outcome_records
for update
using (
  api.is_workspace_member(workspace_id)
  and (
    actor_user_id = auth.uid()
    or api.has_workspace_role(workspace_id, array['owner','admin','manager'])
  )
)
with check (
  api.is_workspace_member(workspace_id)
  and (
    actor_user_id = auth.uid()
    or api.has_workspace_role(workspace_id, array['owner','admin','manager'])
  )
);

create table if not exists api.account_recommendation_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  account_id uuid not null references api.leads(id) on delete cascade,
  recommendation_version text not null,
  window text not null,
  priority_score int not null,
  feature_key text not null,
  computed_at timestamptz not null default now(),
  unique (workspace_id, account_id, recommendation_version, window)
);

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='api' and c.relname='account_rec_snapshots_workspace_idx') then
    create index account_rec_snapshots_workspace_idx on api.account_recommendation_snapshots (workspace_id, computed_at desc);
  end if;
end $$;

alter table api.account_recommendation_snapshots enable row level security;

drop policy if exists account_rec_snapshots_select on api.account_recommendation_snapshots;
create policy account_rec_snapshots_select
on api.account_recommendation_snapshots
for select
using (api.is_workspace_member(workspace_id));

drop policy if exists account_rec_snapshots_upsert on api.account_recommendation_snapshots;
create policy account_rec_snapshots_upsert
on api.account_recommendation_snapshots
for insert
with check (api.is_workspace_member(workspace_id));

drop policy if exists account_rec_snapshots_update on api.account_recommendation_snapshots;
create policy account_rec_snapshots_update
on api.account_recommendation_snapshots
for update
using (api.is_workspace_member(workspace_id))
with check (api.is_workspace_member(workspace_id));

notify pgrst, 'reload schema';
commit;

