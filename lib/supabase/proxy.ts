import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getDbSchema } from './schema'
import { AuthApiError } from '@supabase/supabase-js'
import { isE2E } from '@/lib/runtimeFlags'

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
 * Update Supabase session via middleware
 * Handles cookie passthrough and session refresh
 * Follows Supabase SSR Next.js App Router documentation
 * 
 * Configured with schema from environment (default: 'api')
 */
let refreshWarningLogged = false

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // In Playwright/E2E, we use a fake Supabase client; don't attempt session refresh.
  if (isE2E()) {
    return response
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = getSupabaseKey()
  const { primary } = getDbSchema()

  if (!supabaseUrl || !supabaseKey) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    db: {
      schema: primary,
    },
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value,
          ...options,
        })
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })
        response.cookies.set({
          name,
          value,
          ...options,
        })
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value: '',
          ...options,
        })
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })
        response.cookies.set({
          name,
          value: '',
          ...options,
        })
      },
    },
  })

  // Refresh session if expired - required for Server Components
  try {
    await supabase.auth.getUser()
  } catch (error: any) {
    // Handle refresh token issues gracefully (suppress spam - this is common on first visit or after logout)
    // We suppress this error because:
    // 1. It's expected when cookies are stale/invalid (common in dev)
    // 2. The user is effectively unauthenticated, which is handled by auth checks
    // 3. Logging every request would create noise in production logs
    if (error instanceof AuthApiError && error.message?.includes('refresh_token_not_found')) {
      // Only log once per process lifetime to avoid spam
      if (!refreshWarningLogged && process.env.NODE_ENV === 'development') {
        console.debug('[supabase] refresh_token_not_found (treating as unauthenticated). This is normal on first visit or after logout. To fix: clear localhost cookies or use incognito.')
        refreshWarningLogged = true
      }
      // Clear all Supabase auth cookies silently - treat as unauthenticated
      const cookieNames = [
        'sb-refresh-token',
        'sb-access-token',
        'sb-provider-token',
        'sb-provider-refresh-token'
      ]
      cookieNames.forEach(name => {
        response.cookies.set(name, '', { maxAge: 0, path: '/' })
      })
      // Return response without error - auth checks will handle unauthenticated state
      return response
    }
    // Unknown auth errors: log once per process (not per request)
    if (!refreshWarningLogged) {
      console.error('[supabase] auth error in middleware:', error)
      refreshWarningLogged = true
    }
  }

  return response
}