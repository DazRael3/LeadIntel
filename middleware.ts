import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { applySecurityHeadersEdge } from '@/lib/api/security-edge'
import { getOrCreateRequestId, setRequestIdHeader } from '@/lib/observability/request-id'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { getDbSchema } from '@/lib/supabase/schema'
import { getReviewSessionFromRequest, clearReviewSessionCookies } from '@/lib/review/session'

function shouldRedirectWwwToApex(request: NextRequest): boolean {
  // Always keep canonical host on apex to prevent split SEO + cookie/origin drift.
  // Only redirect in production and only for www.raelinfo.com.
  if ((process.env.NODE_ENV ?? 'development') !== 'production') return false
  const host = request.headers.get('host') ?? ''
  return host.toLowerCase() === 'www.raelinfo.com'
}

function redirectWwwToApex(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone()
  url.hostname = 'raelinfo.com'
  // Preserve path/query; enforce https scheme.
  url.protocol = 'https:'
  return NextResponse.redirect(url, 308)
}

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
  // Host parity: enforce apex canonical host.
  // Do this before session refresh to avoid double-work and reduce edge variability.
  if (shouldRedirectWwwToApex(request)) {
    const res = redirectWwwToApex(request)
    return applySecurityHeadersEdge(res, request)
  }

  // Generate or get request ID for correlation
  const requestId = getOrCreateRequestId(request)
  
  // Update Supabase session (handles cookie passthrough).
  // IMPORTANT: middleware must never hard-crash the site if optional config is missing.
  // If session refresh fails, we fail-open with NextResponse.next() so public routes stay up.
  let response: NextResponse
  try {
    response = await updateSession(request)
  } catch (error: unknown) {
    // Best-effort log (no secrets). Avoid per-request spam by letting updateSession manage logging when possible.
    if (process.env.NODE_ENV === 'development') {
      console.error('[middleware] updateSession failed (fail-open)', {
        message: error instanceof Error ? error.message : String(error),
      })
    }
    response = NextResponse.next()
  }

  // Enforce Review Mode expiration:
  // if the shared demo reviewer user is still authenticated but the review session cookie is missing,
  // clear auth cookies so the session cannot be used outside Review Mode.
  const demoEmail = (process.env.REVIEW_DEMO_EMAIL ?? '').trim().toLowerCase()
  // Treat invalid/expired cookies as "no review session".
  const hasReviewSession = Boolean(getReviewSessionFromRequest(request))
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
        // Also clear any stale/tampered review cookies so the UI can't treat them as active.
        clearReviewSessionCookies(response)
      }
    } catch {
      // ignore
    }
  }
  
  // Add request ID to response headers
  setRequestIdHeader(response, requestId)
  
  // Apply security headers to all responses
  return applySecurityHeadersEdge(response, request)
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
