-- 0031_lifecycle_batch_context.sql
-- Batch context helper for fast lifecycle sweeps (service-role only).

begin;

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
  email text,
  subscription_tier text,
  product_tips_opt_in boolean,
  ideal_customer text,
  what_you_sell text,
  leads_count int,
  pitches_count int,
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
      ls.winback_sent_at
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
    u.email,
    u.subscription_tier,
    coalesce(us.product_tips_opt_in, true) as product_tips_opt_in,
    us.ideal_customer,
    us.what_you_sell,
    coalesce(lc.leads_count, 0) as leads_count,
    coalesce(pc.pitches_count, 0) as pitches_count,
    (uu.user_id is not null) or (u.subscription_tier = 'pro') as upgraded
  from batch b
  left join api.user_settings us on us.user_id = b.user_id
  left join api.users u on u.id = b.user_id
  left join lead_counts lc on lc.user_id = b.user_id
  left join pitch_counts pc on pc.user_id = b.user_id
  left join upgraded_users uu on uu.user_id = b.user_id;
$$;

notify pgrst, 'reload schema';

commit;

