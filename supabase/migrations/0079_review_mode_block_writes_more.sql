begin;

set local search_path = public, extensions, api;

-- Review mode write restrictions (expanded).
-- Goal: ensure demo/review users cannot mutate tenant data even if they call PostgREST directly.
--
-- We use RESTRICTIVE policies so they apply in addition to any existing permissive policies.
-- Each table is wrapped in an exception block for idempotency across older schemas.

do $$
begin
  -- Workspace governance / membership surfaces
  begin
    alter table api.workspaces enable row level security;
    drop policy if exists workspaces_block_review_insert on api.workspaces;
    create policy workspaces_block_review_insert on api.workspaces
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists workspaces_block_review_update on api.workspaces;
    create policy workspaces_block_review_update on api.workspaces
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists workspaces_block_review_delete on api.workspaces;
    create policy workspaces_block_review_delete on api.workspaces
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.workspace_members enable row level security;
    drop policy if exists workspace_members_block_review_insert on api.workspace_members;
    create policy workspace_members_block_review_insert on api.workspace_members
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists workspace_members_block_review_update on api.workspace_members;
    create policy workspace_members_block_review_update on api.workspace_members
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists workspace_members_block_review_delete on api.workspace_members;
    create policy workspace_members_block_review_delete on api.workspace_members
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.workspace_invites enable row level security;
    drop policy if exists workspace_invites_block_review_insert on api.workspace_invites;
    create policy workspace_invites_block_review_insert on api.workspace_invites
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists workspace_invites_block_review_update on api.workspace_invites;
    create policy workspace_invites_block_review_update on api.workspace_invites
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists workspace_invites_block_review_delete on api.workspace_invites;
    create policy workspace_invites_block_review_delete on api.workspace_invites
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.workspace_policies enable row level security;
    drop policy if exists workspace_policies_block_review_insert on api.workspace_policies;
    create policy workspace_policies_block_review_insert on api.workspace_policies
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists workspace_policies_block_review_update on api.workspace_policies;
    create policy workspace_policies_block_review_update on api.workspace_policies
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists workspace_policies_block_review_delete on api.workspace_policies;
    create policy workspace_policies_block_review_delete on api.workspace_policies
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  -- Templates / approvals / collaboration
  begin
    alter table api.template_sets enable row level security;
    drop policy if exists template_sets_block_review_insert on api.template_sets;
    create policy template_sets_block_review_insert on api.template_sets
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists template_sets_block_review_update on api.template_sets;
    create policy template_sets_block_review_update on api.template_sets
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists template_sets_block_review_delete on api.template_sets;
    create policy template_sets_block_review_delete on api.template_sets
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.templates enable row level security;
    drop policy if exists templates_block_review_insert on api.templates;
    create policy templates_block_review_insert on api.templates
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists templates_block_review_update on api.templates;
    create policy templates_block_review_update on api.templates
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists templates_block_review_delete on api.templates;
    create policy templates_block_review_delete on api.templates
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.approval_requests enable row level security;
    drop policy if exists approval_requests_block_review_insert on api.approval_requests;
    create policy approval_requests_block_review_insert on api.approval_requests
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists approval_requests_block_review_update on api.approval_requests;
    create policy approval_requests_block_review_update on api.approval_requests
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists approval_requests_block_review_delete on api.approval_requests;
    create policy approval_requests_block_review_delete on api.approval_requests
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.comment_threads enable row level security;
    drop policy if exists comment_threads_block_review_insert on api.comment_threads;
    create policy comment_threads_block_review_insert on api.comment_threads
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists comment_threads_block_review_update on api.comment_threads;
    create policy comment_threads_block_review_update on api.comment_threads
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists comment_threads_block_review_delete on api.comment_threads;
    create policy comment_threads_block_review_delete on api.comment_threads
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.comments enable row level security;
    drop policy if exists comments_block_review_insert on api.comments;
    create policy comments_block_review_insert on api.comments
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists comments_block_review_update on api.comments;
    create policy comments_block_review_update on api.comments
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists comments_block_review_delete on api.comments;
    create policy comments_block_review_delete on api.comments
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  -- Action queue / recipes surfaces
  begin
    alter table api.action_recipes enable row level security;
    drop policy if exists action_recipes_block_review_insert on api.action_recipes;
    create policy action_recipes_block_review_insert on api.action_recipes
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists action_recipes_block_review_update on api.action_recipes;
    create policy action_recipes_block_review_update on api.action_recipes
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists action_recipes_block_review_delete on api.action_recipes;
    create policy action_recipes_block_review_delete on api.action_recipes
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.action_queue_items enable row level security;
    drop policy if exists action_queue_items_block_review_insert on api.action_queue_items;
    create policy action_queue_items_block_review_insert on api.action_queue_items
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists action_queue_items_block_review_update on api.action_queue_items;
    create policy action_queue_items_block_review_update on api.action_queue_items
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists action_queue_items_block_review_delete on api.action_queue_items;
    create policy action_queue_items_block_review_delete on api.action_queue_items
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  -- Webhooks + exports + platform keys
  begin
    alter table api.webhook_endpoints enable row level security;
    drop policy if exists webhook_endpoints_block_review_insert on api.webhook_endpoints;
    create policy webhook_endpoints_block_review_insert on api.webhook_endpoints
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists webhook_endpoints_block_review_update on api.webhook_endpoints;
    create policy webhook_endpoints_block_review_update on api.webhook_endpoints
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists webhook_endpoints_block_review_delete on api.webhook_endpoints;
    create policy webhook_endpoints_block_review_delete on api.webhook_endpoints
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.export_jobs enable row level security;
    drop policy if exists export_jobs_block_review_insert on api.export_jobs;
    create policy export_jobs_block_review_insert on api.export_jobs
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists export_jobs_block_review_update on api.export_jobs;
    create policy export_jobs_block_review_update on api.export_jobs
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists export_jobs_block_review_delete on api.export_jobs;
    create policy export_jobs_block_review_delete on api.export_jobs
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.api_keys enable row level security;
    drop policy if exists api_keys_block_review_insert on api.api_keys;
    create policy api_keys_block_review_insert on api.api_keys
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists api_keys_block_review_update on api.api_keys;
    create policy api_keys_block_review_update on api.api_keys
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists api_keys_block_review_delete on api.api_keys;
    create policy api_keys_block_review_delete on api.api_keys
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  -- Watchlists v2 (Closer) + reminders
  begin
    alter table api.watchlists enable row level security;
    drop policy if exists watchlists_block_review_insert on api.watchlists;
    create policy watchlists_block_review_insert on api.watchlists
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists watchlists_block_review_update on api.watchlists;
    create policy watchlists_block_review_update on api.watchlists
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists watchlists_block_review_delete on api.watchlists;
    create policy watchlists_block_review_delete on api.watchlists
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.watchlist_items enable row level security;
    drop policy if exists watchlist_items_block_review_insert on api.watchlist_items;
    create policy watchlist_items_block_review_insert on api.watchlist_items
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists watchlist_items_block_review_update on api.watchlist_items;
    create policy watchlist_items_block_review_update on api.watchlist_items
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists watchlist_items_block_review_delete on api.watchlist_items;
    create policy watchlist_items_block_review_delete on api.watchlist_items
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;
end $$;

notify pgrst, 'reload schema';
commit;

