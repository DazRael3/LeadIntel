-- LeadIntel: premium fields (lead_score, saved_companies)
-- Idempotent migration

begin;

-- Add lead_score to leads
alter table api.leads
  add column if not exists lead_score integer;

-- Add saved_companies to user_settings
alter table api.user_settings
  add column if not exists saved_companies jsonb default '[]'::jsonb;

commit;
