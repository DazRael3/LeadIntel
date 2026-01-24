import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getDbSchema } from './schema'
import { isE2E } from '@/lib/runtimeFlags'
import { createE2EServerSupabaseClient } from './e2e'

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
 * Server-side Supabase client for Route Handlers and Server Components
 * Uses Next.js cookies to maintain authentication state
 * Follows Supabase SSR Next.js App Router documentation
 * 
 * Configured with schema from environment (default: 'api')
 */
export function createClient() {
  if (isE2E()) {
    const cookieStore = cookies()
    return createE2EServerSupabaseClient({
      getCookie: (name) => cookieStore.get(name)?.value,
    })
  }
  const cookieStore = cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = getSupabaseKey()
  const { primary } = getDbSchema()

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    db: {
      schema: primary,
    },
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}