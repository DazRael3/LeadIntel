begin;

create extension if not exists pgcrypto;
set local search_path = public, extensions, api;

-- Expand lifecycle_state to cover launch-safe automation (idempotent).
alter table api.lifecycle_state
  add column if not exists first_login_at timestamptz,
  add column if not exists first_output_at timestamptz,
  add column if not exists first_output_sent_at timestamptz,
  add column if not exists starter_near_limit_sent_at timestamptz,
  add column if not exists starter_exhausted_sent_at timestamptz,
  add column if not exists feedback_request_sent_at timestamptz,
  add column if not exists upgrade_confirm_sent_at timestamptz;

-- Minimal email send log for idempotency across cron reruns and event hooks.
-- This is NOT a marketing automation platform; it only exists to prevent duplicates safely.
create table if not exists api.email_send_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  dedupe_key text not null,
  user_id uuid null references auth.users(id) on delete set null,
  to_email text not null,
  kind text not null,
  template text not null,
  status text not null check (status in ('sent','skipped','failed')) default 'skipped',
  sent_at timestamptz null,
  provider text null,
  provider_message_id text null,
  error text null,
  meta jsonb not null default '{}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'email_send_log_dedupe_key_uq'
  ) then
    create unique index email_send_log_dedupe_key_uq on api.email_send_log(dedupe_key);
  end if;
end $$;

create index if not exists email_send_log_user_created_idx on api.email_send_log(user_id, created_at desc);
create index if not exists email_send_log_created_at_idx on api.email_send_log(created_at desc);

alter table api.email_send_log enable row level security;

-- Users can read their own send log rows (no sensitive body content is stored).
drop policy if exists email_send_log_select_own on api.email_send_log;
create policy email_send_log_select_own
on api.email_send_log
for select
to authenticated
using (user_id = auth.uid());

-- Users can insert/update only their own rows (used by request-triggered hooks like /api/lifecycle/ensure).
drop policy if exists email_send_log_insert_own on api.email_send_log;
create policy email_send_log_insert_own
on api.email_send_log
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists email_send_log_update_own on api.email_send_log;
create policy email_send_log_update_own
on api.email_send_log
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete on api.email_send_log to authenticated;
grant select, insert, update, delete on api.email_send_log to service_role;

-- Update the lifecycle batch RPC to include premium-generation usage signals.
-- NOTE: we only return counts/timestamps, never content.
-- This migration must apply on databases where an older version of the RPC already exists.
-- Postgres cannot "CREATE OR REPLACE" a function if its return type changes, so we drop first.
drop function if exists api.lifecycle_batch_context(int);
create or replace function api.lifecycle_batch_context(p_limit int)
returns table(
  user_id uuid,
  signup_at timestamptz,
  last_checked_at timestamptz,
  welcome_sent_at timestamptz,
  nudge_accounts_sent_at timestamptz,
  nudge_pitch_sent_at timestamptz,
  value_recap_sent_at timestamptz,
  winback_sent_at timestamptz,
  first_output_sent_at timestamptz,
  starter_near_limit_sent_at timestamptz,
  starter_exhausted_sent_at timestamptz,
  feedback_request_sent_at timestamptz,
  upgrade_confirm_sent_at timestamptz,
  email text,
  subscription_tier text,
  product_tips_opt_in boolean,
  ideal_customer text,
  what_you_sell text,
  leads_count int,
  pitches_count int,
  premium_used int,
  premium_first_at timestamptz,
  upgraded boolean
)
language sql
stable
as $$
  with batch as (
    select
      ls.user_id,
      ls.signup_at,
      ls.last_checked_at,
      ls.welcome_sent_at,
      ls.nudge_accounts_sent_at,
      ls.nudge_pitch_sent_at,
      ls.value_recap_sent_at,
      ls.winback_sent_at,
      ls.first_output_sent_at,
      ls.starter_near_limit_sent_at,
      ls.starter_exhausted_sent_at,
      ls.feedback_request_sent_at,
      ls.upgrade_confirm_sent_at
    from api.lifecycle_state ls
    order by coalesce(ls.last_checked_at, '1970-01-01'::timestamptz) asc, ls.signup_at asc
    limit greatest(p_limit, 1)
  ),
  lead_counts as (
    select l.user_id, count(*)::int as leads_count
    from api.leads l
    where l.user_id in (select user_id from batch)
    group by l.user_id
  ),
  pitch_counts as (
    select p.user_id, count(*)::int as pitches_count
    from api.pitches p
    where p.user_id in (select user_id from batch)
    group by p.user_id
  ),
  usage_counts as (
    select ue.user_id,
      count(*)::int as premium_used,
      min(ue.created_at) as premium_first_at
    from api.usage_events ue
    where ue.user_id in (select user_id from batch)
      and ue.status = 'complete'
      and ue.object_type in ('pitch','report')
    group by ue.user_id
  ),
  upgraded_users as (
    select distinct s.user_id
    from api.subscriptions s
    where s.user_id in (select user_id from batch)
      and s.status in ('active','trialing')
  )
  select
    b.user_id,
    b.signup_at,
    b.last_checked_at,
    b.welcome_sent_at,
    b.nudge_accounts_sent_at,
    b.nudge_pitch_sent_at,
    b.value_recap_sent_at,
    b.winback_sent_at,
    b.first_output_sent_at,
    b.starter_near_limit_sent_at,
    b.starter_exhausted_sent_at,
    b.feedback_request_sent_at,
    b.upgrade_confirm_sent_at,
    u.email,
    u.subscription_tier,
    coalesce(us.product_tips_opt_in, true) as product_tips_opt_in,
    us.ideal_customer,
    us.what_you_sell,
    coalesce(lc.leads_count, 0) as leads_count,
    coalesce(pc.pitches_count, 0) as pitches_count,
    coalesce(uc.premium_used, 0) as premium_used,
    uc.premium_first_at,
    (uu.user_id is not null) or (u.subscription_tier in ('pro','closer_plus','team')) as upgraded
  from batch b
  left join api.user_settings us on us.user_id = b.user_id
  left join api.users u on u.id = b.user_id
  left join lead_counts lc on lc.user_id = b.user_id
  left join pitch_counts pc on pc.user_id = b.user_id
  left join usage_counts uc on uc.user_id = b.user_id
  left join upgraded_users uu on uu.user_id = b.user_id;
$$;

revoke all on function api.lifecycle_batch_context(int) from public;
grant execute on function api.lifecycle_batch_context(int) to authenticated;
grant execute on function api.lifecycle_batch_context(int) to service_role;

notify pgrst, 'reload schema';
commit;

