-- LeadIntel: weekly digest settings fields on user_settings (api schema)
-- Adds digest preference columns with proper constraints and defaults

begin;

-- Add columns if they don't exist
alter table api.user_settings
  add column if not exists digest_enabled boolean,
  add column if not exists digest_dow int2,
  add column if not exists digest_hour int2,
  add column if not exists digest_webhook_url text,
  add column if not exists digest_last_sent_at timestamptz;

-- Set defaults for existing rows
update api.user_settings
set 
  digest_enabled = coalesce(digest_enabled, false),
  digest_dow = coalesce(digest_dow, 1),
  digest_hour = coalesce(digest_hour, 9)
where digest_enabled is null or digest_dow is null or digest_hour is null;

-- Add constraints and NOT NULL (idempotent via do blocks)
do $$
begin
  -- Set NOT NULL on digest_enabled
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'api' 
      and table_name = 'user_settings' 
      and column_name = 'digest_enabled'
      and is_nullable = 'YES'
  ) then
    alter table api.user_settings alter column digest_enabled set default false;
    alter table api.user_settings alter column digest_enabled set not null;
  end if;

  -- Set NOT NULL and check constraint on digest_dow
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'api' 
      and table_name = 'user_settings' 
      and column_name = 'digest_dow'
      and is_nullable = 'YES'
  ) then
    alter table api.user_settings alter column digest_dow set default 1;
    alter table api.user_settings alter column digest_dow set not null;
    
    -- Add check constraint if it doesn't exist
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'api.user_settings'::regclass
        and conname = 'user_settings_digest_dow_check'
    ) then
      alter table api.user_settings 
        add constraint user_settings_digest_dow_check 
        check (digest_dow between 0 and 6);
    end if;
  end if;

  -- Set NOT NULL and check constraint on digest_hour
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'api' 
      and table_name = 'user_settings' 
      and column_name = 'digest_hour'
      and is_nullable = 'YES'
  ) then
    alter table api.user_settings alter column digest_hour set default 9;
    alter table api.user_settings alter column digest_hour set not null;
    
    -- Add check constraint if it doesn't exist
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'api.user_settings'::regclass
        and conname = 'user_settings_digest_hour_check'
    ) then
      alter table api.user_settings 
        add constraint user_settings_digest_hour_check 
        check (digest_hour between 0 and 23);
    end if;
  end if;
end $$;

commit;
