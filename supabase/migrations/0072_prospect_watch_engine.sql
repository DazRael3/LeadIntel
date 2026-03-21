begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- Prospect watch engine: workspace-scoped, review-first by default.
-- No external sending occurs unless explicitly enabled at runtime and a human approves.

create table if not exists api.prospect_watch_targets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  status text not null check (status in ('active','archived')) default 'active',
  company_name text not null,
  company_domain text null,
  website_url text null,
  icp_notes text null,
  icp_fit_manual_score int not null default 50 check (icp_fit_manual_score >= 0 and icp_fit_manual_score <= 100),
  last_ingested_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prospect_watch_targets_updated_at') then
    create trigger trg_prospect_watch_targets_updated_at
    before update on api.prospect_watch_targets
    for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists pwt_workspace_status_idx on api.prospect_watch_targets (workspace_id, status);
create index if not exists pwt_workspace_created_at_idx on api.prospect_watch_targets (workspace_id, created_at desc);
create index if not exists pwt_workspace_domain_idx on api.prospect_watch_targets (workspace_id, lower(coalesce(company_domain,'')));

create table if not exists api.prospect_watch_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  target_id uuid null references api.prospect_watch_targets(id) on delete set null,
  source_type text not null check (source_type in ('manual','rss','public_page')) default 'rss',
  source_url text not null,
  source_name text null,
  signal_type text not null check (signal_type in ('hiring','funding','product_launch','partnership','expansion','leadership_hire','stack_change','other')) default 'other',
  title text not null,
  summary text null,
  occurred_at timestamptz null,
  detected_at timestamptz not null default now(),
  confidence int not null default 50 check (confidence >= 0 and confidence <= 100),
  meta jsonb not null default '{}'::jsonb
);

-- Dedup signals by source URL within workspace.
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'pws_workspace_source_url_uq'
  ) then
    create unique index pws_workspace_source_url_uq on api.prospect_watch_signals (workspace_id, source_url);
  end if;
end $$;

create index if not exists pws_workspace_detected_idx on api.prospect_watch_signals (workspace_id, detected_at desc);
create index if not exists pws_workspace_type_idx on api.prospect_watch_signals (workspace_id, signal_type);

create table if not exists api.prospect_watch_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  target_id uuid not null references api.prospect_watch_targets(id) on delete cascade,
  signal_id uuid not null references api.prospect_watch_signals(id) on delete cascade,
  icp_fit_score int not null check (icp_fit_score >= 0 and icp_fit_score <= 100),
  signal_strength_score int not null check (signal_strength_score >= 0 and signal_strength_score <= 100),
  urgency_score int not null check (urgency_score >= 0 and urgency_score <= 100),
  confidence_score int not null check (confidence_score >= 0 and confidence_score <= 100),
  overall_score int not null check (overall_score >= 0 and overall_score <= 100),
  reasons jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'pws_target_signal_uq'
  ) then
    create unique index pws_target_signal_uq on api.prospect_watch_scores (target_id, signal_id);
  end if;
end $$;

create index if not exists pws_workspace_overall_idx on api.prospect_watch_scores (workspace_id, overall_score desc, computed_at desc);

create table if not exists api.prospect_watch_prospects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  target_id uuid not null references api.prospect_watch_targets(id) on delete cascade,
  signal_id uuid not null references api.prospect_watch_signals(id) on delete cascade,
  score_id uuid null references api.prospect_watch_scores(id) on delete set null,
  status text not null check (status in ('new','reviewed','approved','rejected','sent','archived')) default 'new',
  reviewer_user_id uuid null references auth.users(id) on delete set null,
  overall_score int not null default 0 check (overall_score >= 0 and overall_score <= 100),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prospect_watch_prospects_updated_at') then
    create trigger trg_prospect_watch_prospects_updated_at
    before update on api.prospect_watch_prospects
    for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'pwp_workspace_target_signal_uq'
  ) then
    create unique index pwp_workspace_target_signal_uq on api.prospect_watch_prospects (workspace_id, target_id, signal_id);
  end if;
end $$;

create index if not exists pwp_workspace_status_idx on api.prospect_watch_prospects (workspace_id, status, overall_score desc, updated_at desc);
create index if not exists pwp_workspace_updated_idx on api.prospect_watch_prospects (workspace_id, updated_at desc);

create table if not exists api.prospect_watch_outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  prospect_id uuid not null references api.prospect_watch_prospects(id) on delete cascade,
  channel text not null check (channel in ('email','follow_up','linkedin_dm','call_opener')),
  status text not null check (status in ('draft','approved','sent','rejected','archived')) default 'draft',
  to_email text null,
  subject text null,
  body text not null,
  approved_by uuid null references auth.users(id) on delete set null,
  approved_at timestamptz null,
  sent_at timestamptz null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prospect_watch_outreach_drafts_updated_at') then
    create trigger trg_prospect_watch_outreach_drafts_updated_at
    before update on api.prospect_watch_outreach_drafts
    for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists pwod_workspace_status_idx on api.prospect_watch_outreach_drafts (workspace_id, status, created_at desc);
create index if not exists pwod_prospect_channel_idx on api.prospect_watch_outreach_drafts (prospect_id, channel);

-- Enforce one draft per (prospect, channel) so upserts can use onConflict safely.
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'pwod_prospect_channel_uq'
  ) then
    create unique index pwod_prospect_channel_uq on api.prospect_watch_outreach_drafts (prospect_id, channel);
  end if;
end $$;

create table if not exists api.prospect_watch_content_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  prospect_id uuid not null references api.prospect_watch_prospects(id) on delete cascade,
  kind text not null check (kind in ('linkedin_post')) default 'linkedin_post',
  status text not null check (status in ('draft','approved','rejected','archived','exported')) default 'draft',
  angle text not null,
  body text not null,
  cta text null,
  approved_by uuid null references auth.users(id) on delete set null,
  approved_at timestamptz null,
  exported_at timestamptz null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prospect_watch_content_drafts_updated_at') then
    create trigger trg_prospect_watch_content_drafts_updated_at
    before update on api.prospect_watch_content_drafts
    for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists pwcd_workspace_status_idx on api.prospect_watch_content_drafts (workspace_id, status, created_at desc);
create index if not exists pwcd_prospect_idx on api.prospect_watch_content_drafts (prospect_id);

-- Enforce one draft per (prospect, kind) so upserts can use onConflict safely.
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'pwcd_prospect_kind_uq'
  ) then
    create unique index pwcd_prospect_kind_uq on api.prospect_watch_content_drafts (prospect_id, kind);
  end if;
end $$;

-- RLS: workspace-scoped; only owner/admin/manager can use prospect watch tables.
alter table api.prospect_watch_targets enable row level security;
alter table api.prospect_watch_signals enable row level security;
alter table api.prospect_watch_scores enable row level security;
alter table api.prospect_watch_prospects enable row level security;
alter table api.prospect_watch_outreach_drafts enable row level security;
alter table api.prospect_watch_content_drafts enable row level security;

-- Shared predicate: user must have privileged workspace membership.
-- (We inline this for clarity rather than creating a new SQL function.)
drop policy if exists pwt_rw on api.prospect_watch_targets;
create policy pwt_rw
on api.prospect_watch_targets
for all
to authenticated
using (
  exists (
    select 1
    from api.workspace_members wm
    where wm.workspace_id = prospect_watch_targets.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
)
with check (
  exists (
    select 1
    from api.workspace_members wm
    where wm.workspace_id = prospect_watch_targets.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
);

drop policy if exists pws_rw on api.prospect_watch_signals;
create policy pws_rw
on api.prospect_watch_signals
for all
to authenticated
using (
  exists (
    select 1 from api.workspace_members wm
    where wm.workspace_id = prospect_watch_signals.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
)
with check (
  exists (
    select 1 from api.workspace_members wm
    where wm.workspace_id = prospect_watch_signals.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
);

drop policy if exists pwscores_rw on api.prospect_watch_scores;
create policy pwscores_rw
on api.prospect_watch_scores
for all
to authenticated
using (
  exists (
    select 1 from api.workspace_members wm
    where wm.workspace_id = prospect_watch_scores.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
)
with check (
  exists (
    select 1 from api.workspace_members wm
    where wm.workspace_id = prospect_watch_scores.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
);

drop policy if exists pwp_rw on api.prospect_watch_prospects;
create policy pwp_rw
on api.prospect_watch_prospects
for all
to authenticated
using (
  exists (
    select 1 from api.workspace_members wm
    where wm.workspace_id = prospect_watch_prospects.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
)
with check (
  exists (
    select 1 from api.workspace_members wm
    where wm.workspace_id = prospect_watch_prospects.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
);

drop policy if exists pwod_rw on api.prospect_watch_outreach_drafts;
create policy pwod_rw
on api.prospect_watch_outreach_drafts
for all
to authenticated
using (
  exists (
    select 1 from api.workspace_members wm
    where wm.workspace_id = prospect_watch_outreach_drafts.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
)
with check (
  exists (
    select 1 from api.workspace_members wm
    where wm.workspace_id = prospect_watch_outreach_drafts.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
);

drop policy if exists pwcd_rw on api.prospect_watch_content_drafts;
create policy pwcd_rw
on api.prospect_watch_content_drafts
for all
to authenticated
using (
  exists (
    select 1 from api.workspace_members wm
    where wm.workspace_id = prospect_watch_content_drafts.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
)
with check (
  exists (
    select 1 from api.workspace_members wm
    where wm.workspace_id = prospect_watch_content_drafts.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','manager')
  )
);

grant select, insert, update, delete on api.prospect_watch_targets to authenticated;
grant select, insert, update, delete on api.prospect_watch_signals to authenticated;
grant select, insert, update, delete on api.prospect_watch_scores to authenticated;
grant select, insert, update, delete on api.prospect_watch_prospects to authenticated;
grant select, insert, update, delete on api.prospect_watch_outreach_drafts to authenticated;
grant select, insert, update, delete on api.prospect_watch_content_drafts to authenticated;

notify pgrst, 'reload schema';
commit;

