begin;

-- Store webhook signing secrets in a separate table that is only readable by the service role.
-- `api.webhook_endpoints` keeps a hash for integrity + rotation, but secrets are never returned.

-- Ensure pgcrypto digest() is available and resolvable on Supabase.
create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

alter table api.webhook_endpoints
  add column if not exists secret_hash text null;

create table if not exists api.webhook_endpoint_secrets (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references api.webhook_endpoints(id) on delete cascade,
  secret text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz null
);

alter table api.webhook_endpoint_secrets enable row level security;

-- No RLS select policies on secrets table: authenticated users cannot read secrets.
-- Inserts/rotations are performed server-side (service role).

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'api' and table_name = 'webhook_endpoints' and column_name = 'secret'
  ) then
    -- Backfill existing rows into secrets table (one-time) and hash.
    insert into api.webhook_endpoint_secrets (endpoint_id, secret, created_by)
    select e.id, e.secret, e.created_by
    from api.webhook_endpoints e
    where (e.secret is not null and length(trim(e.secret)) > 0)
      and not exists (
        select 1 from api.webhook_endpoint_secrets s where s.endpoint_id = e.id
      );

    update api.webhook_endpoints e
       set secret_hash = encode(digest(convert_to(e.secret, 'utf8'), 'sha256'), 'hex')
     where e.secret is not null and length(trim(e.secret)) > 0;

    alter table api.webhook_endpoints drop column if exists secret;
  end if;
end $$;

-- Ensure secret_hash is present for enabled endpoints moving forward.
update api.webhook_endpoints
   set secret_hash = coalesce(secret_hash, '')
 where secret_hash is null;

alter table api.webhook_endpoints
  alter column secret_hash set not null;

notify pgrst, 'reload schema';
commit;

