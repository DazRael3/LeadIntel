begin;

set local search_path = public, extensions, api;

-- Review mode write restrictions (fill remaining legacy gaps).
-- Goal: ensure review/demo users cannot mutate legacy user-scoped tables when they exist.
-- Use RESTRICTIVE policies so they apply in addition to existing permissive policies.

do $$
begin
  -- Legacy watchlist table (api.watchlist)
  begin
    alter table api.watchlist enable row level security;
    drop policy if exists watchlist_block_review_insert on api.watchlist;
    create policy watchlist_block_review_insert on api.watchlist
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists watchlist_block_review_update on api.watchlist;
    create policy watchlist_block_review_update on api.watchlist
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists watchlist_block_review_delete on api.watchlist;
    create policy watchlist_block_review_delete on api.watchlist
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  -- Tags + lead_tags are user-scoped and writable; block in review mode.
  begin
    alter table api.tags enable row level security;
    drop policy if exists tags_block_review_insert on api.tags;
    create policy tags_block_review_insert on api.tags
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists tags_block_review_update on api.tags;
    create policy tags_block_review_update on api.tags
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists tags_block_review_delete on api.tags;
    create policy tags_block_review_delete on api.tags
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;

  begin
    alter table api.lead_tags enable row level security;
    drop policy if exists lead_tags_block_review_insert on api.lead_tags;
    create policy lead_tags_block_review_insert on api.lead_tags
      as restrictive for insert to authenticated
      with check (not api.is_review_user());
    drop policy if exists lead_tags_block_review_update on api.lead_tags;
    create policy lead_tags_block_review_update on api.lead_tags
      as restrictive for update to authenticated
      using (not api.is_review_user())
      with check (not api.is_review_user());
    drop policy if exists lead_tags_block_review_delete on api.lead_tags;
    create policy lead_tags_block_review_delete on api.lead_tags
      as restrictive for delete to authenticated
      using (not api.is_review_user());
  exception when undefined_table then
    -- ignore
  end;
end $$;

notify pgrst, 'reload schema';
commit;

