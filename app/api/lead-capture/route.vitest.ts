import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const insertMock = vi.fn(async (_row: unknown) => ({ error: null }))
const getUserMock = vi.fn(async () => ({ data: { user: null }, error: null }))
const sendEmailWithResendMock = vi.fn(async () => ({ ok: true, messageId: 'msg_1' }))
const sendEmailDedupedMock = vi.fn(async () => ({ ok: true, status: 'sent', messageId: 'dedupe_msg_1' }))
const createOpenAIMock = vi.fn(async () => ({
  choices: [
    {
      message: {
        content:
          'Practical onboarding sequence for your team\nIdentify one high-signal ICP segment\nLaunch a first trigger-driven workflow\nReview outcomes and optimize daily priorities\nTime-to-value: 1 business day',
      },
    },
  ],
}))
const OpenAIMock = vi.fn(function OpenAIMockConstructor() {
  return {
    chat: {
      completions: {
        create: createOpenAIMock,
      },
    },
  }
})

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
    from: vi.fn(() => ({
      insert: insertMock,
    })),
  })),
}))

vi.mock('@/lib/email/resend', () => ({
  sendEmailWithResend: sendEmailWithResendMock,
}))

vi.mock('@/lib/email/send-deduped', () => ({
  sendEmailDeduped: sendEmailDedupedMock,
}))

vi.mock('openai', () => ({
  default: OpenAIMock,
}))

describe('/api/lead-capture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.RESEND_API_KEY = 're_test'
    process.env.RESEND_FROM_EMAIL = 'leadintel@dazrael.com'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED = '1'
    process.env.LIFECYCLE_ADMIN_EMAILS = 'ops@example.com'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'
  })

  it('accepts a minimal payload and writes lead capture', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'buyer@example.com',
        intent: 'demo',
        route: '/pricing',
        deviceClass: 'mobile',
        viewport: { w: 390, h: 844 },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        email: 'buyer@example.com',
        intent: 'demo',
        route: '/pricing',
        device_class: 'mobile',
        viewport_w: 390,
        viewport_h: 844,
        dedupe_key: expect.any(String),
      })
    )
    expect(sendEmailWithResendMock).toHaveBeenCalledTimes(1)
    expect(sendEmailWithResendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        subject: expect.stringContaining('[LeadIntel Demo]['),
        text: expect.stringContaining('Auto-generated demo outline:'),
      })
    )
    expect(sendEmailDedupedMock).toHaveBeenCalled()
  })

  it('rejects invalid payloads', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ email: 'nope', route: '' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('falls back to deterministic plan when AI generation fails', async () => {
    createOpenAIMock.mockRejectedValueOnce(new Error('provider unavailable'))
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'fallback@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { data?: { followUp?: { demoPlanSource?: string; sent?: boolean } } }
    expect(res.status).toBe(201)
    expect(json.data?.followUp?.sent).toBe(true)
    expect(json.data?.followUp?.demoPlanSource).toBe('fallback')
    expect(sendEmailWithResendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Expected time-to-value: 1-2 business days'),
      })
    )
  })

  it('uses fallback plan when OpenAI key is missing', async () => {
    delete process.env.OPENAI_API_KEY
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'no-key@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { data?: { followUp?: { demoPlanSource?: string; sent?: boolean } } }
    expect(res.status).toBe(201)
    expect(json.data?.followUp?.sent).toBe(true)
    expect(json.data?.followUp?.demoPlanSource).toBe('fallback')
    expect(OpenAIMock).not.toHaveBeenCalled()
  })
})

