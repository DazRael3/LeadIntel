import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

function extractDemoUsageCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null
  const matched = setCookieHeader.match(/li_demo_usage=([^;]+)/)
  if (!matched || matched.length < 2) return null
  return decodeURIComponent(matched[1])
}

describe('/api/sample-digest', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'test')
    // Ensure rate limiting is deterministic in tests; this suite validates demo usage limits, not IP burst protection.
    vi.doMock('@/lib/rateLimit', () => ({
      checkPublicRateLimit: vi.fn(async () => ({
        ok: true,
        remaining: 99,
        reset: Math.floor(Date.now() / 1000) + 600,
      })),
    }))
    const globalState = globalThis as Record<string, unknown>
    delete globalState.__leadintelPublicRateLimitStore
  })

  it('returns deterministic sample output (no auth)', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/sample-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyOrUrl: 'acme.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.data?.sample?.score).toBe('number')
    expect(Array.isArray(json.data?.sample?.triggers)).toBe(true)
    expect(Array.isArray(json.data?.sample?.scoreFactors)).toBe(true)
    expect(typeof json.data?.sample?.whyNow).toBe('string')
    expect(typeof json.data?.sample?.updatedAt).toBe('string')

    const req2 = new NextRequest('http://localhost:3000/api/sample-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyOrUrl: 'acme.com' }),
    })
    const res2 = await POST(req2)
    const json2 = await res2.json()
    expect(json2.ok).toBe(true)
    expect(json2.data.sample.score).toBe(json.data.sample.score)
    expect(json2.data.sample.triggers).toEqual(json.data.sample.triggers)
  })

  it('accepts common mobile inputs (company name, domain, www, url)', async () => {
    const { POST } = await import('./route')
    const inputs = ['Google', 'Google.com', 'www.google.com', 'google.com/', ' https://www.google.com/ ']
    for (const v of inputs) {
      const req = new NextRequest('http://localhost:3000/api/sample-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ companyOrUrl: v }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
    }
  })

  it('rejects invalid body with 400', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/sample-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyOrUrl: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('VALIDATION_ERROR')
  })

  it('handles email request gracefully when Resend is not configured', async () => {
    // Treat as "not configured" by removing the env var entirely (empty string can fail env validation).
    delete process.env.RESEND_API_KEY
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/sample-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyOrUrl: 'Acme', emailMe: true, email: 'test@example.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.email.requested).toBe(true)
    expect(json.data.email.sent).toBe(false)
  })

  it('sends email when Resend is configured', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('RESEND_FROM_EMAIL', 'leadintel@dazrael.com')
    vi.doMock('@/lib/email/resend', () => ({
      sendEmailWithResend: vi.fn(async () => ({ ok: true, messageId: 'msg_123' })),
    }))

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/sample-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyOrUrl: 'Acme', emailMe: true, email: 'test@example.com' }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.email.requested).toBe(true)
    expect(json.data.email.sent).toBe(true)
  })

  it('sets demo handoff cookie when session is stored', async () => {
    vi.doMock('@/lib/demo/handoff', () => ({
      createDemoSessionHandoff: vi.fn(async () => ({ token: 'token_1234567890token_1234567890' })),
      setDemoHandoffCookie: vi.fn(({ response, token }: { response: Response; token: string }) => {
        const nextResponse = response as unknown as { cookies: { set: (name: string, value: string, options: { path: string }) => void } }
        nextResponse.cookies.set('li_demo_handoff', token, { path: '/' })
      }),
    }))

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/sample-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyOrUrl: 'Acme' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.handoff?.stored).toBe(true)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie.includes('li_demo_handoff=token_1234567890token_1234567890')).toBe(true)
  })

  it('returns free limit response after 2 runs in a day', async () => {
    const { POST } = await import('./route')
    const today = new Date().toISOString().slice(0, 10)
    const sessionId = 'test-session-id-123456'
    const forwardedFor = '203.0.113.25'

    const requestWithCookie = (cookie?: string) =>
      new NextRequest('http://localhost:3000/api/sample-digest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          'x-forwarded-for': forwardedFor,
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify({ companyOrUrl: 'acme.com', sessionId }),
      })

    const firstRes = await POST(requestWithCookie())
    expect(firstRes.status).toBe(200)
    const firstJson = await firstRes.json()
    expect(firstJson.ok).toBe(true)
    expect(firstJson.data?.usage?.runsToday).toBe(1)
    expect(firstJson.data?.usage?.maxRunsPerDay).toBe(2)
    const firstCookieRaw = extractDemoUsageCookie(firstRes.headers.get('set-cookie'))
    expect(firstCookieRaw).not.toBeNull()
    const firstCookie = JSON.parse(firstCookieRaw ?? '{}') as { sessionId?: string; date?: string; runs?: number }
    expect(firstCookie.sessionId).toBe(sessionId)
    expect(firstCookie.date).toBe(today)
    expect(firstCookie.runs).toBe(1)

    const secondRes = await POST(
      requestWithCookie(
        `li_demo_usage=${encodeURIComponent(JSON.stringify({ sessionId, date: today, runs: 1 }))}`
      )
    )
    expect(secondRes.status).toBe(200)
    const secondJson = await secondRes.json()
    expect(secondJson.ok).toBe(true)
    expect(secondJson.data?.usage?.runsToday).toBe(2)
    expect(secondJson.data?.usage?.maxRunsPerDay).toBe(2)
    const secondCookieRaw = extractDemoUsageCookie(secondRes.headers.get('set-cookie'))
    expect(secondCookieRaw).not.toBeNull()
    const secondCookie = JSON.parse(secondCookieRaw ?? '{}') as { sessionId?: string; date?: string; runs?: number }
    expect(secondCookie.sessionId).toBe(sessionId)
    expect(secondCookie.date).toBe(today)
    expect(secondCookie.runs).toBe(2)

    const blockedRes = await POST(
      requestWithCookie(
        `li_demo_usage=${encodeURIComponent(JSON.stringify({ sessionId, date: today, runs: 2 }))}`
      )
    )
    expect(blockedRes.status).toBe(429)
    const body = await blockedRes.json()
    expect(body.ok).toBe(false)
    const errorCode = typeof body.error === 'string' ? body.error : body.error?.code
    expect(errorCode).toBe('RATE_LIMIT_EXCEEDED')
    const runsToday = typeof body.runsToday === 'number' ? body.runsToday : body.error?.details?.runsToday
    expect(runsToday).toBeGreaterThanOrEqual(2)
    expect(body.error?.details?.maxRunsPerDay).toBe(2)
  })

  it('returns free limit response when cookie already records two runs today', async () => {
    const { POST } = await import('./route')
    const today = new Date().toISOString().slice(0, 10)
    const sessionId = 'test-session-id-123456'

    const blockedRes = await POST(
      new NextRequest('http://localhost:3000/api/sample-digest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          'x-forwarded-for': '203.0.113.25',
          cookie: `li_demo_usage=${encodeURIComponent(JSON.stringify({ sessionId, date: today, runs: 2 }))}`,
        },
        body: JSON.stringify({ companyOrUrl: 'acme.com', sessionId }),
      })
    )
    expect(blockedRes.status).toBe(429)
    const body = await blockedRes.json()
    expect(body.ok).toBe(false)
    const errorCode = typeof body.error === 'string' ? body.error : body.error?.code
    expect(errorCode).toBe('RATE_LIMIT_EXCEEDED')
    const runsToday = typeof body.runsToday === 'number' ? body.runsToday : body.error?.details?.runsToday
    expect(runsToday).toBeGreaterThanOrEqual(2)
    expect(body.error?.details?.maxRunsPerDay).toBe(2)
  })
})

