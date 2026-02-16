-- LeadIntel: Ensure UNIQUE constraint exists for leads upsert
-- This constraint matches the onConflict target used in app/api/generate-pitch/route.ts
-- onConflict: 'user_id,company_domain'

BEGIN;

-- Add unique constraint to match onConflict 'user_id,company_domain'
-- This constraint already exists in 0002_leads_unique_constraints.sql, but we ensure it's present
-- as a safety check in case migrations were applied out of order
DO $$
BEGIN
  -- Check if constraint already exists (from migration 0002)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_user_company_domain_key'
      AND conrelid = 'api.leads'::regclass
  ) THEN
    -- Also check for alternative constraint name
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'leads_user_domain_unique'
        AND conrelid = 'api.leads'::regclass
    ) THEN
      -- Add the constraint
      ALTER TABLE api.leads
        ADD CONSTRAINT leads_user_company_domain_key UNIQUE (user_id, company_domain);
    END IF;
  END IF;
END $$;

-- Ensure company_domain is NOT NULL for existing rows (set to empty string if null)
-- This ensures the unique constraint works correctly
UPDATE api.leads
SET company_domain = COALESCE(company_domain, '')
WHERE company_domain IS NULL;

-- Add NOT NULL constraint if it doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'api'
      AND table_name = 'leads'
      AND column_name = 'company_domain'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE api.leads
      ALTER COLUMN company_domain SET DEFAULT '',
      ALTER COLUMN company_domain SET NOT NULL;
  END IF;
END $$;

COMMIT;
