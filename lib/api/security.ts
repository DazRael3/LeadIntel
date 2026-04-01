/**
 * Security Utilities
 * 
 * Provides origin validation and security headers for production-safe API routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { fail, ErrorCode } from './http'

/**
 * Local origins that should be allowed in non-production deployments
 * These are safe to allow when running locally with `npm run start`
 */
const LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
]

function expandWwwVariants(origin: string): string[] {
  try {
    const u = new URL(origin)
    const host = u.hostname
    if (!host) return [origin]
    if (host.startsWith('www.')) {
      const noWww = host.slice('www.'.length)
      if (!noWww) return [origin]
      const alt = new URL(origin)
      alt.hostname = noWww
      return [origin, alt.origin]
    }
    const alt = new URL(origin)
    alt.hostname = `www.${host}`
    return [origin, alt.origin]
  } catch {
    return [origin]
  }
}

/**
 * Get allowed origins from environment
 * Supports multiple origins separated by commas
 */
function getAllowedOrigins(): string[] {
  // Get from env or use site URL as default
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS
  // IMPORTANT: keep this module safe to import from middleware/edge.
  // Do not use strict env validation helpers here; rely on raw env reads.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  
  const origins: string[] = []
  
  // Add site URL if configured
  if (siteUrl) {
    origins.push(...expandWwwVariants(siteUrl))
  }
  
  // Add origins from env var
  if (allowedOriginsEnv) {
    const envOrigins = allowedOriginsEnv.split(',').map(o => o.trim()).filter(Boolean)
    for (const o of envOrigins) origins.push(...expandWwwVariants(o))
  }
  
  // In development, allow localhost
  if ((process.env.NODE_ENV ?? 'development') === 'development') {
    origins.push(...LOCAL_ORIGINS)
  }
  
  return Array.from(new Set(origins))
}

/**
 * Validate request origin for state-changing endpoints
 * 
 * @param request - Next.js request object
 * @param route - Route path for logging
 * @returns Error response if origin is invalid, null if valid
 */
export function validateOrigin(
  request: NextRequest,
  route: string
): NextResponse | null {
  // Skip origin validation for Stripe webhook (uses signature verification instead)
  if (route === '/api/stripe/webhook') {
    return null
  }
  
  // Skip origin validation for GET requests (read-only)
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return null
  }
  
  // Get origin from request
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  
  // In development, be more lenient
  if ((process.env.NODE_ENV ?? 'development') === 'development') {
    // Allow requests without origin in development (e.g., Postman, curl)
    if (!origin && !referer) {
      return null
    }
  }
  
  // Get allowed origins
  const allowedOrigins = getAllowedOrigins()
  
  // If no allowed origins configured, skip validation (but log warning in production)
  if (allowedOrigins.length === 0) {
    if ((process.env.NODE_ENV ?? 'development') === 'production') {
      console.warn('[security] No ALLOWED_ORIGINS configured. Origin validation disabled.')
    }
    return null
  }
  
  // Extract origin from referer if origin header is missing
  let requestOrigin = origin
  if (!requestOrigin && referer) {
    try {
      const refererUrl = new URL(referer)
      requestOrigin = refererUrl.origin
    } catch {
      // Invalid referer URL, continue with null
    }
  }
  
  // If still no origin, reject in production
  if (!requestOrigin) {
    if ((process.env.NODE_ENV ?? 'development') === 'production') {
      return fail(
        ErrorCode.FORBIDDEN,
        'Missing Origin header',
        {
          hint: 'State-changing requests must include an Origin header',
        },
        { status: 403 },
        undefined
      )
    }
    // In development, allow
    return null
  }
  
  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowed => {
    // Exact match
    if (allowed === requestOrigin) {
      return true
    }
    
    // Support wildcard subdomains (e.g., *.example.com)
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2) // Remove '*.'
      try {
        const originUrl = new URL(requestOrigin)
        const originHost = originUrl.hostname
        // Check if origin host ends with domain (e.g., app.example.com ends with .example.com)
        if (originHost === domain || originHost.endsWith('.' + domain)) {
          return true
        }
      } catch {
        // Invalid origin URL
        return false
      }
    }
    
    return false
  })
  
  if (!isAllowed) {
    return fail(
      ErrorCode.FORBIDDEN,
      'Origin not allowed',
      {
        origin: requestOrigin,
        allowedOrigins: allowedOrigins,
        hint: 'Request origin does not match allowed origins',
      },
      { status: 403 },
      undefined
    )
  }
  
  return null
}

/**
 * Get security headers for responses
 * 
 * @param request - Next.js request object (for HSTS conditional)
 * @returns Headers object with security headers
 */
export function getSecurityHeaders(request: NextRequest): HeadersInit {
  const headers: HeadersInit = {}
  
  // Cross-Origin-Opener-Policy: isolate browsing context group
  headers['Cross-Origin-Opener-Policy'] = 'same-origin'
  // Cross-Origin-Resource-Policy: restrict who can embed resources
  headers['Cross-Origin-Resource-Policy'] = 'same-site'

  // X-Content-Type-Options: Prevent MIME type sniffing
  headers['X-Content-Type-Options'] = 'nosniff'
  
  // Referrer-Policy: Control referrer information
  headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
  
  // X-Frame-Options: Prevent clickjacking (legacy, for older browsers)
  headers['X-Frame-Options'] = 'DENY'
  
  // Permissions-Policy: Restrict browser features
  headers['Permissions-Policy'] = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
  ].join(', ')
  
  // HSTS: Only in production and for HTTPS
  if ((process.env.NODE_ENV ?? 'development') === 'production') {
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const protocol = (forwardedProto ?? request.nextUrl.protocol.replace(':', '')).toLowerCase()
    if (protocol === 'https') {
      // HSTS: 1 year, includeSubDomains, preload
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    }
  }
  
  // Content-Security-Policy: conservative baseline with Stripe/PostHog/Supabase compatibility.
  // Default to report-only unless explicitly enforced, to avoid breaking production unexpectedly.
  const enforce = (process.env.ENFORCE_CSP ?? '').trim() === '1'
  const cspKey = enforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only'
  headers[cspKey] = buildCsp()
  
  return headers
}

function originFromUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  try {
    return new URL(v).origin
  } catch {
    return null
  }
}

function buildCsp(): string {
  const supabaseOrigin = originFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  const posthogOrigin =
    originFromUrl(process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '') ?? originFromUrl(process.env.POSTHOG_HOST ?? '')

  const connectSrc = new Set<string>(["'self'", 'https:', 'wss:'])
  if (supabaseOrigin) connectSrc.add(supabaseOrigin)
  if (posthogOrigin) connectSrc.add(posthogOrigin)

  const directives: string[] = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: https:",
    "font-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline' https:",
    // Next.js requires relaxed script-src unless you implement a nonce-based CSP.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https:",
    `connect-src ${Array.from(connectSrc).join(' ')}`,
    'frame-src https://js.stripe.com https://hooks.stripe.com',
  ]
  return directives.join('; ')
}

/**
 * Apply security headers to a response
 * 
 * @param response - NextResponse to add headers to
 * @param request - Original request (for HSTS conditional)
 * @returns Response with security headers applied
 */
export function applySecurityHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const securityHeaders = getSecurityHeaders(request)
  
  // Apply headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
}
