-- 0033_health_ping_rpc.sql
-- Create a lightweight DB ping RPC in public schema so PostgREST can always see it.

create or replace function public.health_ping()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object('ok', true, 'ts', now());
$$;

-- Allow API roles to call it (anon + authenticated).
revoke all on function public.health_ping() from public;
grant execute on function public.health_ping() to anon, authenticated;

