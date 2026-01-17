BEGIN;

-- Ensure schema
create schema if not exists api;

-- Normalize domains going forward (optional safety)
create or replace function api.normalize_company_domain()
returns trigger
language plpgsql
as $$
begin
  if new.company_domain is not null then
    new.company_domain := lower(trim(new.company_domain));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_normalize_domain on api.leads;
create trigger trg_leads_normalize_domain
before insert or update on api.leads
for each row execute function api.normalize_company_domain();

-- CRITICAL: UNIQUE constraint matching ON CONFLICT(user_id, company_domain)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_user_domain_unique'
  ) then
    alter table api.leads
      add constraint leads_user_domain_unique unique (user_id, company_domain);
  end if;
end $$;

-- Helpful indexes
create index if not exists leads_user_id_idx on api.leads(user_id);
create index if not exists leads_user_domain_idx on api.leads(user_id, company_domain);

commit;
-- LeadIntel: enforce leads upsert constraint and user_settings onboarding flag
-- Fixes: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Safe to re-run; guards check existing constraints.

begin;

-- Ensure user_settings has required columns (idempotent)
alter table api.user_settings
  add column if not exists onboarding_completed boolean default false;

-- Backfill nulls then enforce not-null
update api.user_settings set onboarding_completed = false where onboarding_completed is null;
alter table api.user_settings alter column onboarding_completed set not null;

-- Add unique constraint to match onConflict 'user_id,company_domain'
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_user_company_domain_key'
      and conrelid = 'api.leads'::regclass
  ) then
    alter table api.leads
      add constraint leads_user_company_domain_key unique (user_id, company_domain);
  end if;
end $$;

-- Support index for lookups (idempotent)
create index if not exists idx_leads_user_company_domain on api.leads(user_id, company_domain);

commit;
