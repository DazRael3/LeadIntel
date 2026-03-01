import { createBrowserClient } from '@supabase/ssr'
import { getDbSchema } from './schema'
import { isE2E } from '@/lib/runtimeFlags'
import { createE2EBrowserSupabaseClient } from './e2e'

/**
 * Get Supabase anon key - supports both env var naming conventions
 */
function getSupabaseKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  )
}

/**
 * Client-side Supabase client for Client Components
 * Uses browser storage to maintain authentication state
 * Follows Supabase SSR Next.js App Router documentation
 * 
 * Configured with schema from environment (default: 'api')
 */
export function createClient() {
  if (isE2E()) {
    return createE2EBrowserSupabaseClient()
  }
  // Next.js can execute Client Components during server prerender/build.
  // The browser Supabase client must never be instantiated on the server, and build
  // environments may not have NEXT_PUBLIC_SUPABASE_* configured.
  if (typeof window === 'undefined') {
    return new Proxy(
      {},
      {
        get() {
          throw new Error('Supabase browser client was accessed on the server')
        },
      }
    ) as unknown as ReturnType<typeof createBrowserClient>
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = getSupabaseKey()
  const { primary } = getDbSchema()

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient(supabaseUrl, supabaseKey, {
    db: {
      schema: primary,
    },
  })
}