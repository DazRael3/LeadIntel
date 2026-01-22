import { createClient } from '@supabase/supabase-js'
import { clientEnv, serverEnv } from '@/lib/env'

/**
 * Supabase admin client (service role).
 *
 * IMPORTANT:
 * - Bypasses RLS. Only use in server-only contexts (cron, webhooks).
 * - Always write tenant keys (user_id/workspace_id) explicitly to preserve isolation.
 */
export function createSupabaseAdminClient() {
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

