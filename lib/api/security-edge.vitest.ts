import { describe, expect, it } from 'vitest'
import { NextResponse, type NextRequest } from 'next/server'

import { applySecurityHeadersEdge } from './security-edge'

function makeReq(url: string, headers: Record<string, string> = {}): NextRequest {
  return { nextUrl: new URL(url), headers: new Headers(headers) } as unknown as NextRequest
}

describe('applySecurityHeadersEdge', () => {
  it('does not throw when server-only env vars are missing', () => {
    const oldEnv = process.env
    process.env = {
      ...oldEnv,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SITE_URL: '',
      // Intentionally omit server-only secrets like OPENAI_API_KEY/STRIPE_SECRET_KEY
    }

    const res = NextResponse.next()
    const req = makeReq('https://dazrael.com/')

    expect(() => applySecurityHeadersEdge(res, req)).not.toThrow()
    // Default: report-only unless explicitly enabled.
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeTruthy()

    process.env = oldEnv
  })

  it('adds HSTS only for https requests in production', () => {
    const oldEnv = process.env
    process.env = { ...oldEnv, NODE_ENV: 'production' }

    const res = NextResponse.next()
    const req = makeReq('https://dazrael.com/', { 'x-forwarded-proto': 'https' })
    applySecurityHeadersEdge(res, req)
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=')

    const res2 = NextResponse.next()
    const req2 = makeReq('http://dazrael.com/', { 'x-forwarded-proto': 'http' })
    applySecurityHeadersEdge(res2, req2)
    expect(res2.headers.get('Strict-Transport-Security')).toBeNull()

    process.env = oldEnv
  })

  it('enforces CSP only when ENFORCE_CSP=1', () => {
    const oldEnv = process.env
    process.env = { ...oldEnv, NODE_ENV: 'production', ENFORCE_CSP: '1' }

    const res = NextResponse.next()
    const req = makeReq('https://dazrael.com/', { 'x-forwarded-proto': 'https' })
    applySecurityHeadersEdge(res, req)
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull()

    process.env = oldEnv
  })
})

