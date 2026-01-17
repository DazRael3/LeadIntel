/**
 * Security Utilities
 * 
 * Provides origin validation and security headers for production-safe API routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverEnv, clientEnv } from '@/lib/env'
import { fail, ErrorCode } from './http'

/**
 * Get allowed origins from environment
 * Supports multiple origins separated by commas
 */
function getAllowedOrigins(): string[] {
  // Get from env or use site URL as default
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS
  const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL
  
  const origins: string[] = []
  
  // Add site URL if configured
  if (siteUrl) {
    origins.push(siteUrl)
  }
  
  // Add origins from env var
  if (allowedOriginsEnv) {
    const envOrigins = allowedOriginsEnv.split(',').map(o => o.trim()).filter(Boolean)
    origins.push(...envOrigins)
  }
  
  // In development, allow localhost
  if (serverEnv.NODE_ENV === 'development') {
    origins.push('http://localhost:3000', 'http://127.0.0.1:3000')
  }
  
  return origins
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
  if (serverEnv.NODE_ENV === 'development') {
    // Allow requests without origin in development (e.g., Postman, curl)
    if (!origin && !referer) {
      return null
    }
  }
  
  // Get allowed origins
  const allowedOrigins = getAllowedOrigins()
  
  // If no allowed origins configured, skip validation (but log warning in production)
  if (allowedOrigins.length === 0) {
    if (serverEnv.NODE_ENV === 'production') {
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
    if (serverEnv.NODE_ENV === 'production') {
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
    'interest-cohort=()',
  ].join(', ')
  
  // HSTS: Only in production and for HTTPS
  if (serverEnv.NODE_ENV === 'production') {
    const protocol = request.nextUrl.protocol
    if (protocol === 'https:') {
      // HSTS: 1 year, includeSubDomains, preload
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    }
  }
  
  // Content-Security-Policy: Basic CSP (can be customized per route)
  // Note: This is a baseline. Adjust based on your needs.
  // We use a relaxed CSP for Next.js compatibility (allows inline scripts/styles)
  // For stricter security, customize per route or use nonce-based CSP
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for Next.js
    "style-src 'self' 'unsafe-inline'", // Allow inline styles
    "img-src 'self' data: https:", // Allow images from self, data URIs, and HTTPS
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.stripe.com https://api.openai.com https://*.upstash.io", // Allow API calls
    "frame-ancestors 'none'", // Prevent framing (also covered by X-Frame-Options)
  ].join('; ')
  
  headers['Content-Security-Policy'] = csp
  
  return headers
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
