begin;

-- Publish queue: tracks distribution/publishing state for existing high-quality pages.
create table if not exists api.publish_queue (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('template','use_case','compare','tour','roi')),
  slug text not null,
  status text not null check (status in ('queued','published','failed')) default 'queued',
  scheduled_for timestamptz not null default now(),
  published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create unique index if not exists publish_queue_type_slug_unique on api.publish_queue(type, slug);
create index if not exists publish_queue_status_scheduled_idx on api.publish_queue(status, scheduled_for);
create index if not exists publish_queue_published_at_idx on api.publish_queue(published_at desc);

alter table api.publish_queue enable row level security;

-- Post queue: draft posts for manual distribution.
create table if not exists api.post_queue (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('linkedin','x','community')),
  content text not null,
  related_url text not null,
  status text not null check (status in ('queued','posted')) default 'queued',
  created_at timestamptz not null default now()
);

create unique index if not exists post_queue_unique on api.post_queue(channel, related_url, content);
create index if not exists post_queue_status_created_idx on api.post_queue(status, created_at desc);

alter table api.post_queue enable row level security;

-- Singleton-ish state for idempotency (e.g., last distribution time).
create table if not exists api.growth_state (
  key text primary key,
  last_distribution_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_growth_state_updated_at') then
    create trigger trg_growth_state_updated_at
    before update on api.growth_state
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table api.growth_state enable row level security;

-- Deny all access to authenticated users (service role bypasses RLS).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='api' and tablename='publish_queue' and policyname='publish_queue_no_access') then
    create policy "publish_queue_no_access" on api.publish_queue
    for all to authenticated
    using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname='api' and tablename='post_queue' and policyname='post_queue_no_access') then
    create policy "post_queue_no_access" on api.post_queue
    for all to authenticated
    using (false) with check (false);
  end if;

  if not exists (select 1 from pg_policies where schemaname='api' and tablename='growth_state' and policyname='growth_state_no_access') then
    create policy "growth_state_no_access" on api.growth_state
    for all to authenticated
    using (false) with check (false);
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

