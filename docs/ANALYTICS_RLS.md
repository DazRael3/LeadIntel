## Analytics RLS (Engagement + Conversions)

This repo enforces **multi-tenant isolation** for analytics tables via RLS on the `api` schema.

### Tables
- `api.email_engagement` (created by `supabase/migrations/0011_engagement_tracking.sql`)
- `api.conversions` (created by `supabase/migrations/0012_conversion_tracking.sql`)
- Related tenant-scoped tables used by tracking + rollout controls:
  - `api.website_visitors` (created by `supabase/migrations/0004_missing_tables.sql`)
  - `api.email_logs` (created by `supabase/migrations/0004_missing_tables.sql`, extended by `0010_tracking_keys_and_email_logs.sql`)
  - `api.feature_flags` (created by `supabase/migrations/0014_feature_flags.sql`)

Both tables include a **tenant key** column: `user_id`.

### RLS policies (high level)
- **Authenticated reads/writes**: allowed **only** when `auth.uid() = user_id`.
- **Webhooks/cron**: server-side code uses the **Supabase service role** to write rows (service role bypasses RLS), but it must still set `user_id` explicitly.

### Minimal SQL sanity checks

Run these in Supabase SQL editor to validate policy behavior after migrations:

```sql
-- Confirm RLS is enabled
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'api'
  and tablename in ('email_engagement', 'conversions', 'email_logs', 'website_visitors', 'feature_flags');

-- Confirm policies exist
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'api'
  and tablename in ('email_engagement', 'conversions', 'email_logs', 'website_visitors', 'feature_flags');

-- Confirm grants exist for authenticated where expected (feature flags + tracking tables)
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'api'
  and table_name in ('email_logs', 'website_visitors', 'feature_flags')
  and grantee = 'authenticated'
order by table_name, privilege_type;
```

### Optional automated sanity script (staging/prod)

This repo includes a best-effort script that creates two temporary users and verifies RLS isolation for key tables.
It is **not** run in CI.

- Script: `scripts/db-sanity-rls.ts`
- Run:

```bash
RUN_DB_SANITY=1 \
NEXT_PUBLIC_SUPABASE_URL="..." \
NEXT_PUBLIC_SUPABASE_ANON_KEY="..." \
SUPABASE_SERVICE_ROLE_KEY="..." \
npm run db:sanity
```


### Expected behavior
- An authenticated user can only `SELECT/INSERT/UPDATE/DELETE` rows where `user_id = auth.uid()`.
- A user cannot read or write another user’s analytics rows.

