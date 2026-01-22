## Analytics RLS (Engagement + Conversions)

This repo enforces **multi-tenant isolation** for analytics tables via RLS on the `api` schema.

### Tables
- `api.email_engagement` (created by `supabase/migrations/0011_engagement_tracking.sql`)
- `api.conversions` (created by `supabase/migrations/0012_conversion_tracking.sql`)

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
  and tablename in ('email_engagement', 'conversions');

-- Confirm policies exist
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'api'
  and tablename in ('email_engagement', 'conversions');
```

### Expected behavior
- An authenticated user can only `SELECT/INSERT/UPDATE/DELETE` rows where `user_id = auth.uid()`.
- A user cannot read or write another user’s analytics rows.

