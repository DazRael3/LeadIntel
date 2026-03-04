import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

describe('/api/sample-digest', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'test')
    process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123'
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123'
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-openai'
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
    expect(typeof json.data?.sample?.whyNow).toBe('string')

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
})

