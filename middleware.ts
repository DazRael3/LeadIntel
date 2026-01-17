import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { applySecurityHeaders } from '@/lib/api/security'
import { getOrCreateRequestId, setRequestIdHeader } from '@/lib/observability/request-id'

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
