import { createClient } from '@supabase/supabase-js'
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

  // Avoid importing `serverEnv` here: strict env validation can include unrelated secrets
  // and must not crash safe server reads (e.g. plan gating) if optional integrations are off.
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

  assertSupabaseServiceRoleConfigured()

  // IMPORTANT: Billing/plan state is stored in the `api` schema.
  // Some environments may set `NEXT_PUBLIC_SUPABASE_DB_SCHEMA` to "public" for other surfaces,
  // so callers that participate in plan resolution should pass `{ schema: 'api' }`.
  const schema = (options?.schema ?? process.env.SUPABASE_DB_SCHEMA ?? process.env.SUPABASE_DB_SCHEMA_FALLBACK ?? 'api').trim() || 'api'

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role is not configured')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema,
    },
  })
}

