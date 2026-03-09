begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- Assistant threads (workspace-scoped, object-attached)
create table if not exists api.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  target_type text not null,
  target_id uuid null,
  title text null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz null
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_assistant_threads_updated_at') then
    create trigger trg_assistant_threads_updated_at
    before update on api.assistant_threads
    for each row execute function api.set_updated_at();
  end if;
exception when undefined_function then
  -- ignore if set_updated_at is unavailable in this environment
end $$;

create index if not exists assistant_threads_workspace_target_idx
  on api.assistant_threads (workspace_id, target_type, target_id, updated_at desc);
create index if not exists assistant_threads_workspace_updated_idx
  on api.assistant_threads (workspace_id, updated_at desc);

alter table api.assistant_threads enable row level security;

-- Assistant messages (stored, but not used for analytics)
create table if not exists api.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references api.workspaces(id) on delete cascade,
  thread_id uuid not null references api.assistant_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  author_user_id uuid not null references auth.users(id) on delete cascade,
  content_text text not null check (char_length(content_text) <= 8000),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_thread_created_idx
  on api.assistant_messages (thread_id, created_at asc);
create index if not exists assistant_messages_workspace_created_idx
  on api.assistant_messages (workspace_id, created_at desc);

alter table api.assistant_messages enable row level security;

-- RLS: members can read threads/messages; inserts are limited to members creating their own rows.
drop policy if exists assistant_threads_select on api.assistant_threads;
create policy assistant_threads_select on api.assistant_threads
for select using (api.is_workspace_member(workspace_id));

drop policy if exists assistant_threads_insert on api.assistant_threads;
create policy assistant_threads_insert on api.assistant_threads
for insert with check (api.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists assistant_threads_update on api.assistant_threads;
create policy assistant_threads_update on api.assistant_threads
for update using (api.is_workspace_member(workspace_id))
with check (api.is_workspace_member(workspace_id));

drop policy if exists assistant_messages_select on api.assistant_messages;
create policy assistant_messages_select on api.assistant_messages
for select using (api.is_workspace_member(workspace_id));

drop policy if exists assistant_messages_insert on api.assistant_messages;
create policy assistant_messages_insert on api.assistant_messages
for insert with check (api.is_workspace_member(workspace_id) and author_user_id = auth.uid());

commit;

