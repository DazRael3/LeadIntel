begin;

set local search_path = public, extensions, api;

create table if not exists api.lead_ai_pitch_iterations (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references api.ai_generations(id) on delete cascade,
  lead_id uuid not null references api.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  outputs jsonb not null,
  improve_context text null,
  created_at timestamptz not null default now()
);

create unique index if not exists lead_ai_pitch_iterations_generation_idx
  on api.lead_ai_pitch_iterations (generation_id);

create index if not exists lead_ai_pitch_iterations_user_lead_created_idx
  on api.lead_ai_pitch_iterations (user_id, lead_id, created_at desc);

create index if not exists lead_ai_pitch_iterations_outputs_gin_idx
  on api.lead_ai_pitch_iterations using gin (outputs);

alter table api.lead_ai_pitch_iterations enable row level security;

drop policy if exists lead_ai_pitch_iterations_select_own on api.lead_ai_pitch_iterations;
create policy lead_ai_pitch_iterations_select_own
on api.lead_ai_pitch_iterations
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists lead_ai_pitch_iterations_insert_own on api.lead_ai_pitch_iterations;
create policy lead_ai_pitch_iterations_insert_own
on api.lead_ai_pitch_iterations
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists lead_ai_pitch_iterations_delete_own on api.lead_ai_pitch_iterations;
create policy lead_ai_pitch_iterations_delete_own
on api.lead_ai_pitch_iterations
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, delete on api.lead_ai_pitch_iterations to authenticated;

notify pgrst, 'reload schema';
commit;
