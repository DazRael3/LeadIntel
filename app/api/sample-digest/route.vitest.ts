import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

describe('/api/sample-digest', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'test')
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

    const requestWithCookie = (cookie: string) =>
      new NextRequest('http://localhost:3000/api/sample-digest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          cookie,
        },
        body: JSON.stringify({ companyOrUrl: 'acme.com' }),
      })

    const firstRes = await POST(
      requestWithCookie(
        `li_demo_usage=${encodeURIComponent(JSON.stringify({ sessionId: 'test-session', date: '2026-04-25', runs: 1 }))}`
      )
    )
    expect(firstRes.status).toBe(200)
    const firstJson = await firstRes.json()
    expect(firstJson.ok).toBe(true)
    expect(firstJson.data?.usage?.runsToday).toBe(2)
    expect(firstJson.data?.usage?.maxRunsPerDay).toBe(2)

    const blockedRes = await POST(
      requestWithCookie(
        `li_demo_usage=${encodeURIComponent(JSON.stringify({ sessionId: 'test-session', date: '2026-04-25', runs: 2 }))}`
      )
    )
    expect(blockedRes.status).toBe(429)
    const body = await blockedRes.json()
    const errorCode = typeof body.error === 'string' ? body.error : body.error?.code
    expect(errorCode).toBe('RATE_LIMIT_EXCEEDED')
    const runsToday = typeof body.runsToday === 'number' ? body.runsToday : body.error?.details?.runsToday
    expect(runsToday).toBeGreaterThanOrEqual(2)
    expect(body.error?.details?.maxRunsPerDay).toBe(2)
  })
})

