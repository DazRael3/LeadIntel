-- 0026_user_settings_activation_and_email_prefs.sql
-- Adds activation checklist + lifecycle email preferences to api.user_settings (idempotent).

begin;

alter table api.user_settings
  add column if not exists product_tips_opt_in boolean,
  add column if not exists digest_emails_opt_in boolean,
  add column if not exists checklist_state jsonb,
  add column if not exists checklist_completed_at timestamptz,
  add column if not exists last_upgrade_nudge_shown_at timestamptz;

-- Backfill defaults for existing rows
update api.user_settings
set
  product_tips_opt_in = coalesce(product_tips_opt_in, true),
  digest_emails_opt_in = coalesce(digest_emails_opt_in, true),
  checklist_state = coalesce(checklist_state, '{}'::jsonb)
where product_tips_opt_in is null
   or digest_emails_opt_in is null
   or checklist_state is null;

-- Enforce defaults + NOT NULL (idempotent)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'api' and table_name = 'user_settings' and column_name = 'product_tips_opt_in'
      and is_nullable = 'YES'
  ) then
    alter table api.user_settings alter column product_tips_opt_in set default true;
    alter table api.user_settings alter column product_tips_opt_in set not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'api' and table_name = 'user_settings' and column_name = 'digest_emails_opt_in'
      and is_nullable = 'YES'
  ) then
    alter table api.user_settings alter column digest_emails_opt_in set default true;
    alter table api.user_settings alter column digest_emails_opt_in set not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'api' and table_name = 'user_settings' and column_name = 'checklist_state'
      and is_nullable = 'YES'
  ) then
    alter table api.user_settings alter column checklist_state set default '{}'::jsonb;
    alter table api.user_settings alter column checklist_state set not null;
  end if;
end $$;

-- Ensure PostgREST reloads schema after new columns are added
notify pgrst, 'reload schema';

commit;

