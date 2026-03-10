import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { applySecurityHeaders } from '@/lib/api/security'
import { getOrCreateRequestId, setRequestIdHeader } from '@/lib/observability/request-id'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { getDbSchema } from '@/lib/supabase/schema'

function getSupabaseKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  )
}

function clearSupabaseAuthCookies(response: NextResponse): void {
  const cookieNames = ['sb-refresh-token', 'sb-access-token', 'sb-provider-token', 'sb-provider-refresh-token']
  for (const name of cookieNames) {
    response.cookies.set(name, '', { maxAge: 0, path: '/' })
  }
}

/**
 * Next.js Middleware
 * Handles Supabase session refresh, cookie passthrough, security headers, and request correlation
 * 
 * Note: /dashboard route protection is handled server-side in app/dashboard/page.tsx
 * which provides better error handling and user experience.
 */
export async function middleware(request: NextRequest) {
  // Generate or get request ID for correlation
  const requestId = getOrCreateRequestId(request)
  
  // Update Supabase session (handles cookie passthrough)
  const response = await updateSession(request)

  // Enforce Review Mode expiration:
  // if the shared demo reviewer user is still authenticated but the review session cookie is missing,
  // clear auth cookies so the session cannot be used outside Review Mode.
  const demoEmail = (process.env.REVIEW_DEMO_EMAIL ?? '').trim().toLowerCase()
  const hasReviewSession = Boolean(request.cookies.get('li_review_session')?.value)
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const supabaseKey = getSupabaseKey()
  if (demoEmail && !hasReviewSession && supabaseUrl && supabaseKey) {
    try {
      const { primary } = getDbSchema()
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        db: { schema: primary },
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      })
      const { data } = await supabase.auth.getUser()
      const email = (data.user?.email ?? '').trim().toLowerCase()
      if (email && email === demoEmail) {
        clearSupabaseAuthCookies(response)
      }
    } catch {
      // ignore
    }
  }
  
  // Add request ID to response headers
  setRequestIdHeader(response, requestId)
  
  // Apply security headers to all responses
  return applySecurityHeaders(response, request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
