import { createClient } from '@supabase/supabase-js'
import { clientEnv, serverEnv } from '@/lib/env'
import { isE2E } from '@/lib/runtimeFlags'
import { createE2EServerSupabaseClient } from '@/lib/supabase/e2e'

/**
 * Supabase admin client (service role).
 *
 * IMPORTANT:
 * - Bypasses RLS. Only use in server-only contexts (cron, webhooks).
 * - Always write tenant keys (user_id/workspace_id) explicitly to preserve isolation.
 */
export function createSupabaseAdminClient() {
  // In Playwright/E2E runs, use the in-memory Supabase shim to avoid network calls.
  if (isE2E()) {
    return createE2EServerSupabaseClient({
      getCookie: () => undefined,
    })
  }
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: clientEnv.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || 'api',
    },
  })
}

