-- LeadIntel: pitch history + tags
-- Creates pitches, tags, lead_tags; ensures leads columns exist; enforces RLS (api schema)

begin;

-- Ensure leads has expected columns (idempotent)
alter table api.leads
  add column if not exists company_url text,
  add column if not exists company_domain text,
  add column if not exists company_name text,
  add column if not exists ai_personalized_pitch text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- pitches table
create table if not exists api.pitches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references api.leads(id) on delete cascade,
  content text not null,
  model text,
  tokens integer,
  created_at timestamptz default now()
);

-- tags table
create table if not exists api.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- functional unique index for case-insensitive name per user
create unique index if not exists tags_user_lower_name_key
  on api.tags (user_id, lower(name));

-- lead_tags join table
create table if not exists api.lead_tags (
  lead_id uuid references api.leads(id) on delete cascade,
  tag_id uuid references api.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (lead_id, tag_id)
);

-- RLS
alter table api.pitches enable row level security;
alter table api.tags enable row level security;
alter table api.lead_tags enable row level security;

-- Policies: user isolation
do $$
begin
  -- pitches
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='pitches' and policyname='pitches_select_own') then
    create policy "pitches_select_own" on api.pitches for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='pitches' and policyname='pitches_modify_own') then
    create policy "pitches_modify_own" on api.pitches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- tags
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='tags' and policyname='tags_select_own') then
    create policy "tags_select_own" on api.tags for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='tags' and policyname='tags_modify_own') then
    create policy "tags_modify_own" on api.tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- lead_tags
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='lead_tags' and policyname='lead_tags_select_own') then
    create policy "lead_tags_select_own" on api.lead_tags for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='lead_tags' and policyname='lead_tags_modify_own') then
    create policy "lead_tags_modify_own" on api.lead_tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Grants (aligned with app needs; skip anon select if not desired)
grant usage on schema api to authenticated;
grant select, insert, update, delete on api.pitches, api.tags, api.lead_tags to authenticated;

commit;
