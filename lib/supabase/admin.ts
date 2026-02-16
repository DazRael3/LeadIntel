import { createClient } from '@supabase/supabase-js'
import { clientEnv, serverEnv } from '@/lib/env'
import { isE2E } from '@/lib/runtimeFlags'
import { createE2EServerSupabaseClient } from '@/lib/supabase/e2e'
import { assertSupabaseServiceRoleConfigured } from '@/lib/config/runtimeEnv'

/**
 * Supabase admin client (service role).
 *
 * IMPORTANT:
 * - Bypasses RLS. Only use in server-only contexts (cron, webhooks).
 * - Always write tenant keys (user_id/workspace_id) explicitly to preserve isolation.
 */
export function createSupabaseAdminClient(options?: { schema?: string }) {
  // In Playwright/E2E runs, use the in-memory Supabase shim to avoid network calls.
  if (isE2E()) {
    return createE2EServerSupabaseClient({
      getCookie: () => undefined,
    })
  }
  assertSupabaseServiceRoleConfigured()
  // IMPORTANT: Billing/plan state is stored in the `api` schema.
  // Some environments may set `NEXT_PUBLIC_SUPABASE_DB_SCHEMA` to "public" for other surfaces,
  // so callers that participate in plan resolution should pass `{ schema: 'api' }`.
  const schema =
    (options?.schema ?? clientEnv.NEXT_PUBLIC_SUPABASE_DB_SCHEMA ?? 'api').trim() || 'api'
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema,
    },
  })
}

