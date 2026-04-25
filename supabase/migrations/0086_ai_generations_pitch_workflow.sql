begin;

create extension if not exists pgcrypto;

create table if not exists api.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references api.leads(id) on delete cascade,
  generation_type text not null check (
    generation_type in (
      'short_email_opener',
      'full_cold_email',
      'linkedin_dm',
      'pain_point_summary',
      'recommended_offer_angle',
      'objection_handling_notes',
      'pitch_bundle'
    )
  ),
  prompt_input jsonb not null default '{}'::jsonb,
  output_text text not null,
  model text not null default 'gpt-4o-mini',
  prompt_version text not null default 'v1',
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric(10,6) not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_generations_user_created_at_idx
  on api.ai_generations (user_id, created_at desc);

create index if not exists ai_generations_lead_created_at_idx
  on api.ai_generations (lead_id, created_at desc);

create index if not exists ai_generations_generation_type_idx
  on api.ai_generations (generation_type, created_at desc);

create index if not exists ai_generations_prompt_input_gin_idx
  on api.ai_generations using gin (prompt_input);

create index if not exists ai_generations_meta_gin_idx
  on api.ai_generations using gin (meta);

drop trigger if exists trg_ai_generations_updated_at on api.ai_generations;
create trigger trg_ai_generations_updated_at
before update on api.ai_generations
for each row execute function public.set_updated_at();

alter table api.ai_generations enable row level security;

drop policy if exists ai_generations_select_own on api.ai_generations;
create policy ai_generations_select_own
on api.ai_generations
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists ai_generations_insert_own on api.ai_generations;
create policy ai_generations_insert_own
on api.ai_generations
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists ai_generations_update_own on api.ai_generations;
create policy ai_generations_update_own
on api.ai_generations
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists ai_generations_delete_own on api.ai_generations;
create policy ai_generations_delete_own
on api.ai_generations
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on api.ai_generations to authenticated;

notify pgrst, 'reload schema';
commit;
