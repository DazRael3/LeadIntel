-- LeadIntel: privacy-safe benchmarking RPCs (cross-workspace, thresholded)

do $migration$
begin
  -- 1) Workflow norms (no bucket), across all workspaces
  execute $fn$
    create or replace function api.benchmark_workflow_norms(p_days int default 30)
    returns jsonb
    language plpgsql
    security definer
    set search_path = api, public
    as $$
    declare
      v_days int := greatest(7, least(90, coalesce(p_days, 30)));
      v_since timestamptz := now() - make_interval(days => v_days);
      v_ws_count int := 0;
      v_total_actions bigint := 0;
      v_total_outcomes bigint := 0;
      v_deliver_p25 numeric := null;
      v_deliver_p50 numeric := null;
      v_deliver_p75 numeric := null;
      v_stale_p25 numeric := null;
      v_stale_p50 numeric := null;
      v_stale_p75 numeric := null;
      v_blocked_p25 numeric := null;
      v_blocked_p50 numeric := null;
      v_blocked_p75 numeric := null;
      v_outcome_p50 numeric := null;
      v_outcome_p25 numeric := null;
      v_outcome_p75 numeric := null;
    begin
      with per_ws as (
        select
          workspace_id,
          count(*)::bigint as total_actions,
          count(*) filter (where status = 'delivered')::bigint as delivered_actions,
          count(*) filter (where status = 'ready' and created_at < (now() - interval '48 hours'))::bigint as stale_ready_actions,
          count(*) filter (where status in ('blocked','failed'))::bigint as blocked_actions
        from api.action_queue_items
        where created_at >= v_since
        group by workspace_id
      ),
      per_ws_rates as (
        select
          workspace_id,
          total_actions,
          case when total_actions > 0 then delivered_actions::numeric / total_actions::numeric else null end as deliver_rate,
          case when total_actions > 0 then stale_ready_actions::numeric / total_actions::numeric else null end as stale_ready_share,
          case when total_actions > 0 then blocked_actions::numeric / total_actions::numeric else null end as blocked_share
        from per_ws
      ),
      per_ws_outcomes as (
        select
          workspace_id,
          count(*) filter (where outcome in ('replied','meeting_booked','qualified','opportunity_created'))::bigint as progress_outcomes
        from api.outcome_records
        where recorded_at >= v_since
        group by workspace_id
      ),
      per_ws_joined as (
        select
          r.workspace_id,
          r.total_actions,
          r.deliver_rate,
          r.stale_ready_share,
          r.blocked_share,
          coalesce(o.progress_outcomes, 0)::bigint as progress_outcomes,
          case when r.total_actions > 0 then coalesce(o.progress_outcomes, 0)::numeric / r.total_actions::numeric else null end as outcome_rate
        from per_ws_rates r
        left join per_ws_outcomes o on o.workspace_id = r.workspace_id
      )
      select
        count(*)::int,
        coalesce(sum(total_actions), 0)::bigint,
        coalesce(sum(progress_outcomes), 0)::bigint,
        percentile_cont(0.25) within group (order by deliver_rate),
        percentile_cont(0.50) within group (order by deliver_rate),
        percentile_cont(0.75) within group (order by deliver_rate),
        percentile_cont(0.25) within group (order by stale_ready_share),
        percentile_cont(0.50) within group (order by stale_ready_share),
        percentile_cont(0.75) within group (order by stale_ready_share),
        percentile_cont(0.25) within group (order by blocked_share),
        percentile_cont(0.50) within group (order by blocked_share),
        percentile_cont(0.75) within group (order by blocked_share),
        percentile_cont(0.25) within group (order by outcome_rate),
        percentile_cont(0.50) within group (order by outcome_rate),
        percentile_cont(0.75) within group (order by outcome_rate)
      into
        v_ws_count,
        v_total_actions,
        v_total_outcomes,
        v_deliver_p25,
        v_deliver_p50,
        v_deliver_p75,
        v_stale_p25,
        v_stale_p50,
        v_stale_p75,
        v_blocked_p25,
        v_blocked_p50,
        v_blocked_p75,
        v_outcome_p25,
        v_outcome_p50,
        v_outcome_p75
      from per_ws_joined
      where total_actions > 0;

      return jsonb_build_object(
        'windowDays', v_days,
        'cohortWorkspaces', v_ws_count,
        'totalActions', v_total_actions,
        'totalProgressOutcomes', v_total_outcomes,
        'deliverRate', jsonb_build_object('p25', v_deliver_p25, 'p50', v_deliver_p50, 'p75', v_deliver_p75),
        'staleReadyShare', jsonb_build_object('p25', v_stale_p25, 'p50', v_stale_p50, 'p75', v_stale_p75),
        'blockedShare', jsonb_build_object('p25', v_blocked_p25, 'p50', v_blocked_p50, 'p75', v_blocked_p75),
        'progressOutcomeRate', jsonb_build_object('p25', v_outcome_p25, 'p50', v_outcome_p50, 'p75', v_outcome_p75)
      );
    end;
    $$;
  $fn$;

  -- 2) Pattern bucket norms: uses payload_meta->>'patternBucket'
  execute $fn$
    create or replace function api.benchmark_pattern_bucket_norms(p_bucket text, p_days int default 30)
    returns jsonb
    language plpgsql
    security definer
    set search_path = api, public
    as $$
    declare
      v_bucket text := coalesce(nullif(trim(p_bucket), ''), '');
      v_days int := greatest(7, least(90, coalesce(p_days, 30)));
      v_since timestamptz := now() - make_interval(days => v_days);
      v_ws_count int := 0;
      v_total_actions bigint := 0;
      v_deliver_p25 numeric := null;
      v_deliver_p50 numeric := null;
      v_deliver_p75 numeric := null;
    begin
      if v_bucket = '' then
        return jsonb_build_object('windowDays', v_days, 'cohortWorkspaces', 0, 'totalActions', 0);
      end if;

      with per_ws as (
        select
          workspace_id,
          count(*)::bigint as total_actions,
          count(*) filter (where status = 'delivered')::bigint as delivered_actions
        from api.action_queue_items
        where created_at >= v_since
          and payload_meta->>'patternBucket' = v_bucket
        group by workspace_id
      ),
      per_ws_rates as (
        select
          workspace_id,
          total_actions,
          case when total_actions > 0 then delivered_actions::numeric / total_actions::numeric else null end as deliver_rate
        from per_ws
      )
      select
        count(*)::int,
        coalesce(sum(total_actions), 0)::bigint,
        percentile_cont(0.25) within group (order by deliver_rate),
        percentile_cont(0.50) within group (order by deliver_rate),
        percentile_cont(0.75) within group (order by deliver_rate)
      into
        v_ws_count,
        v_total_actions,
        v_deliver_p25,
        v_deliver_p50,
        v_deliver_p75
      from per_ws_rates
      where total_actions > 0;

      return jsonb_build_object(
        'windowDays', v_days,
        'bucket', v_bucket,
        'cohortWorkspaces', v_ws_count,
        'totalActions', v_total_actions,
        'deliverRate', jsonb_build_object('p25', v_deliver_p25, 'p50', v_deliver_p50, 'p75', v_deliver_p75)
      );
    end;
    $$;
  $fn$;

  -- 3) Playbook norms: uses payload_meta->>'playbookSlug'
  execute $fn$
    create or replace function api.benchmark_playbook_norms(p_playbook_slug text, p_days int default 30)
    returns jsonb
    language plpgsql
    security definer
    set search_path = api, public
    as $$
    declare
      v_slug text := coalesce(nullif(trim(p_playbook_slug), ''), '');
      v_days int := greatest(7, least(90, coalesce(p_days, 30)));
      v_since timestamptz := now() - make_interval(days => v_days);
      v_ws_count int := 0;
      v_total_actions bigint := 0;
      v_deliver_p25 numeric := null;
      v_deliver_p50 numeric := null;
      v_deliver_p75 numeric := null;
    begin
      if v_slug = '' then
        return jsonb_build_object('windowDays', v_days, 'cohortWorkspaces', 0, 'totalActions', 0);
      end if;

      with per_ws as (
        select
          workspace_id,
          count(*)::bigint as total_actions,
          count(*) filter (where status = 'delivered')::bigint as delivered_actions
        from api.action_queue_items
        where created_at >= v_since
          and payload_meta->>'playbookSlug' = v_slug
        group by workspace_id
      ),
      per_ws_rates as (
        select
          workspace_id,
          total_actions,
          case when total_actions > 0 then delivered_actions::numeric / total_actions::numeric else null end as deliver_rate
        from per_ws
      )
      select
        count(*)::int,
        coalesce(sum(total_actions), 0)::bigint,
        percentile_cont(0.25) within group (order by deliver_rate),
        percentile_cont(0.50) within group (order by deliver_rate),
        percentile_cont(0.75) within group (order by deliver_rate)
      into
        v_ws_count,
        v_total_actions,
        v_deliver_p25,
        v_deliver_p50,
        v_deliver_p75
      from per_ws_rates
      where total_actions > 0;

      return jsonb_build_object(
        'windowDays', v_days,
        'playbookSlug', v_slug,
        'cohortWorkspaces', v_ws_count,
        'totalActions', v_total_actions,
        'deliverRate', jsonb_build_object('p25', v_deliver_p25, 'p50', v_deliver_p50, 'p75', v_deliver_p75)
      );
    end;
    $$;
  $fn$;
end $migration$;

-- Restrict RPC execution to service role only (enforced by app routes + team gating).
revoke all on function api.benchmark_workflow_norms(int) from public;
revoke all on function api.benchmark_pattern_bucket_norms(text,int) from public;
revoke all on function api.benchmark_playbook_norms(text,int) from public;

grant execute on function api.benchmark_workflow_norms(int) to service_role;
grant execute on function api.benchmark_pattern_bucket_norms(text,int) to service_role;
grant execute on function api.benchmark_playbook_norms(text,int) to service_role;