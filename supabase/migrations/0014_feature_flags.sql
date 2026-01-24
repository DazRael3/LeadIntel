-- 0014_feature_flags.sql
-- Per-tenant (user-scoped) feature flag overrides.
-- Global defaults remain controlled by FEATURE_* environment variables.

DO $$
BEGIN
  -- Ensure schema exists (defensive for older deployments)
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'api') THEN
    CREATE SCHEMA api;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS api.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES api.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  enabled boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feature_flags_feature_len CHECK (char_length(feature) > 0 AND char_length(feature) <= 64)
);

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_user_feature_uq
  ON api.feature_flags (user_id, feature);

COMMENT ON TABLE api.feature_flags IS 'Per-tenant feature flag overrides (user-scoped). RLS restricts access to auth.uid().';
COMMENT ON COLUMN api.feature_flags.feature IS 'Feature key (e.g. clearbit_enrichment, zapier_push).';

-- Keep updated_at current.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_feature_flags_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION api.set_updated_at()
    RETURNS trigger AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    CREATE TRIGGER set_feature_flags_updated_at
    BEFORE UPDATE ON api.feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION api.set_updated_at();
  END IF;
END $$;

ALTER TABLE api.feature_flags ENABLE ROW LEVEL SECURITY;

-- Tenants can manage only their own feature flags.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'feature_flags'
      AND policyname = 'feature_flags_select_own'
  ) THEN
    CREATE POLICY feature_flags_select_own
      ON api.feature_flags
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'feature_flags'
      AND policyname = 'feature_flags_insert_own'
  ) THEN
    CREATE POLICY feature_flags_insert_own
      ON api.feature_flags
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'feature_flags'
      AND policyname = 'feature_flags_update_own'
  ) THEN
    CREATE POLICY feature_flags_update_own
      ON api.feature_flags
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'api'
      AND tablename = 'feature_flags'
      AND policyname = 'feature_flags_delete_own'
  ) THEN
    CREATE POLICY feature_flags_delete_own
      ON api.feature_flags
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

