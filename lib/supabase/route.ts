import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
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
 * Route Handler Supabase client with request/response cookie bridging
 * 
 * This is required for Next.js Route Handlers because cookies() from next/headers
 * alone is not sufficient. We must bridge cookies from NextRequest to NextResponse.
 * 
 * Configured with schema from environment (default: 'api')
 * 
 * Usage:
 *   const res = NextResponse.next()
 *   const supabase = createRouteClient(request, res)
 *   const { data: { user } } = await supabase.auth.getUser()
 *   return res
 */
export function getSchema() {
  const { primary } = getDbSchema()
  return primary
}

export function createRouteClient(request: NextRequest, response: NextResponse) {
  if (isE2E()) {
    return createE2EServerSupabaseClient({
      getCookie: (name) => request.cookies.get(name)?.value,
    })
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = getSupabaseKey()
  const schema = getSchema()

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    db: {
      schema,
    },
    cookies: {
      getAll() {
        // Read cookies from the request
        return request.cookies.getAll().map(cookie => ({
          name: cookie.name,
          value: cookie.value,
        }))
      },
      setAll(cookiesToSet) {
        // Write cookies to the response
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options as CookieOptions)
        })
      },
    },
  })
}

// Helper alias for readability
export function getDbClient(request: NextRequest, response: NextResponse) {
  return createRouteClient(request, response)
}
