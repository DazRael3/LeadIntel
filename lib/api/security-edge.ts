import { type NextRequest, type NextResponse } from 'next/server'

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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https:",
    `connect-src ${Array.from(connectSrc).join(' ')}`,
    'frame-src https://js.stripe.com https://hooks.stripe.com',
  ]
  return directives.join('; ')
}

function getSecurityHeadersEdge(request: NextRequest): HeadersInit {
  const headers: HeadersInit = {}

  headers['Cross-Origin-Opener-Policy'] = 'same-origin'
  headers['Cross-Origin-Resource-Policy'] = 'same-site'
  headers['X-Content-Type-Options'] = 'nosniff'
  headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
  headers['X-Frame-Options'] = 'DENY'
  headers['Permissions-Policy'] = ['camera=()', 'microphone=()', 'geolocation=()'].join(', ')

  const isProd = (process.env.NODE_ENV ?? 'development') === 'production'
  if (isProd) {
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const protocol = (forwardedProto ?? request.nextUrl.protocol.replace(':', '')).toLowerCase()
    if (protocol === 'https') {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    }
  }

  headers['Content-Security-Policy'] = buildCsp()

  return headers
}

export function applySecurityHeadersEdge(response: NextResponse, request: NextRequest): NextResponse {
  const securityHeaders = getSecurityHeadersEdge(request)
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

export function allowedOriginsEdge(): string[] {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()

  const origins: string[] = []
  if (siteUrl) origins.push(...expandWwwVariants(siteUrl))

  if (allowedOriginsEnv) {
    const envOrigins = allowedOriginsEnv.split(',').map((o) => o.trim()).filter(Boolean)
    for (const o of envOrigins) origins.push(...expandWwwVariants(o))
  }

  const isDev = (process.env.NODE_ENV ?? 'development') === 'development'
  if (isDev) origins.push(...LOCAL_ORIGINS)

  return Array.from(new Set(origins))
}

