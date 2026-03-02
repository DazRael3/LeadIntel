import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/email/resend', () => ({
  sendEmailWithResend: vi.fn(async () => ({ ok: true, messageId: 'msg_123' })),
}))

describe('/api/demo/email', () => {
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
    process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_test_123'
    process.env.RESEND_FROM_EMAIL = 'leadintel@dazrael.com'
  })

  it('sends digest email (no auth) and returns sent=true', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/demo/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'buyer@example.com',
        company: 'Acme',
        digestLines: ['LeadIntel Daily Digest (Sample)', 'Company: Acme', 'Fit score: 90/100', 'Recent signals:', '- Funding round'],
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.sent).toBe(true)
  })

  it('rejects invalid email with 422', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/demo/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ email: 'nope', company: 'Acme', digestLines: ['x', 'y', 'z'] }),
    })
    const res = await POST(req)
    // Body validation is enforced by withApiGuard (400 VALIDATION_ERROR)
    expect(res.status).toBe(400)
  })
})

