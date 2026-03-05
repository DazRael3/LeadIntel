begin;

create or replace function public.health_ping()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object('ok', true, 'ts', now());
$$;

revoke all on function public.health_ping() from public;
grant execute on function public.health_ping() to anon, authenticated;

-- Ensure PostgREST sees the new RPC immediately.
notify pgrst, 'reload schema';

commit;

