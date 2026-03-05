begin;

-- Webhook endpoint metadata (non-sensitive).
-- `secret_last4`: last 4 characters of the *raw* secret (for UI confirmation only).
-- `rotated_at`: last time the secret was rotated (or created).

alter table api.webhook_endpoints
  add column if not exists secret_last4 text null,
  add column if not exists rotated_at timestamptz null;

-- Backfill from the most recent secret record when available.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'api' and table_name = 'webhook_endpoint_secrets'
  ) then
    with latest as (
      select distinct on (s.endpoint_id)
        s.endpoint_id,
        s.secret,
        s.created_at
      from api.webhook_endpoint_secrets s
      order by s.endpoint_id, s.created_at desc
    )
    update api.webhook_endpoints e
       set secret_last4 = coalesce(e.secret_last4, nullif(right(latest.secret, 4), '')),
           rotated_at = coalesce(e.rotated_at, latest.created_at, e.created_at)
      from latest
     where latest.endpoint_id = e.id;
  end if;
end $$;

-- Ensure rotated_at is populated for existing endpoints, without fabricating last4.
update api.webhook_endpoints
   set rotated_at = created_at
 where rotated_at is null;

notify pgrst, 'reload schema';
commit;

