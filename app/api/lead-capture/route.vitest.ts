import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { SUPPORT_EMAIL } from '@/lib/config/contact'

const insertMock = vi.fn<(_row: unknown) => Promise<{ error: { code?: string; message?: string } | null }>>(async () => ({
  error: null,
}))
const getUserMock = vi.fn<
  () => Promise<{ data: { user: { id: string } | null }; error: { code?: string; message?: string } | null }>
>(async () => ({ data: { user: null }, error: null }))
const schemaInsertFromMock = vi.fn(() => ({ insert: insertMock }))
const schemaMock = vi.fn((_schema: string) => ({ from: schemaInsertFromMock }))
const fromMock = vi.fn(() => ({ insert: insertMock }))
const adminMaybeSingleMock = vi.fn<
  () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>
>(async () => ({ data: null, error: null }))
const adminUpdateEqMock = vi.fn<() => Promise<{ error: { code?: string; message?: string } | null }>>(async () => ({ error: null }))
const adminUpdateMock = vi.fn((_updates: Record<string, unknown>) => ({ eq: adminUpdateEqMock }))
const adminSelectEqMock = vi.fn((_column: string, _value: string) => ({ maybeSingle: adminMaybeSingleMock }))
const adminSelectMock = vi.fn((_columns: string) => ({ eq: adminSelectEqMock }))
const adminFromMock = vi.fn((_table: string) => ({
  select: adminSelectMock,
  update: adminUpdateMock,
}))
const sendEmailWithResendMock = vi.fn<
  (_args: unknown) => Promise<{ ok: true; messageId: string } | { ok: false; errorMessage: string }>
>(async () => ({ ok: true, messageId: 'resend-msg-1' }))
const sendEmailDedupedMock = vi.fn<
  (_client: unknown, _args: { template?: string }) =>
    Promise<
      | { ok: true; status: 'sent'; messageId: string }
      | { ok: true; status: 'skipped'; reason: 'deduped' | 'not_enabled' | 'schema_not_ready' }
      | { ok: false; status: 'failed'; error: string; retryable: boolean }
    >
>(async () => ({ ok: true, status: 'sent', messageId: 'dedupe-msg-1' }))

const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
const originalResendApiKey = process.env.RESEND_API_KEY
const originalResendFromEmail = process.env.RESEND_FROM_EMAIL
const originalResendReplyToEmail = process.env.RESEND_REPLY_TO_EMAIL
const originalBrandImageUrl = process.env.EMAIL_BRAND_IMAGE_URL
const originalAdminNotificationsEnabled = process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED
const originalAdminEmails = process.env.LIFECYCLE_ADMIN_EMAILS
let requestIpCounter = 10

function leadCaptureHeaders(): Record<string, string> {
  requestIpCounter += 1
  return {
    'Content-Type': 'application/json',
    origin: 'http://localhost:3000',
    'x-forwarded-for': `198.51.100.${requestIpCounter}`,
  }
}

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
    schema: schemaMock,
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: adminFromMock,
  })),
}))

vi.mock('@/lib/email/resend', () => ({
  sendEmailWithResend: sendEmailWithResendMock,
}))

vi.mock('@/lib/email/send-deduped', () => ({
  sendEmailDeduped: sendEmailDedupedMock,
}))

vi.mock('@/lib/supabase/schema', () => ({
  isSchemaError: vi.fn((err: unknown) => {
    const message = String((err as { message?: unknown } | null)?.message ?? '').toLowerCase()
    return message.includes('schema')
  }),
}))

describe('/api/lead-capture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertMock.mockResolvedValue({ error: null })
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    fromMock.mockImplementation(() => ({ insert: insertMock }))
    schemaInsertFromMock.mockImplementation(() => ({ insert: insertMock }))
    schemaMock.mockImplementation((_schema: string) => ({ from: schemaInsertFromMock }))
    adminMaybeSingleMock.mockResolvedValue({ data: null, error: null })
    adminUpdateEqMock.mockResolvedValue({ error: null })
    sendEmailWithResendMock.mockResolvedValue({ ok: true, messageId: 'resend-msg-1' })
    sendEmailDedupedMock.mockResolvedValue({ ok: true, status: 'sent', messageId: 'dedupe-msg-1' })
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM_EMAIL
    delete process.env.RESEND_REPLY_TO_EMAIL
    delete process.env.EMAIL_BRAND_IMAGE_URL
    delete process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED
    delete process.env.LIFECYCLE_ADMIN_EMAILS
  })

  afterAll(() => {
    if (originalServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole
    if (originalResendApiKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalResendApiKey
    if (originalResendFromEmail === undefined) delete process.env.RESEND_FROM_EMAIL
    else process.env.RESEND_FROM_EMAIL = originalResendFromEmail
    if (originalResendReplyToEmail === undefined) delete process.env.RESEND_REPLY_TO_EMAIL
    else process.env.RESEND_REPLY_TO_EMAIL = originalResendReplyToEmail
    if (originalBrandImageUrl === undefined) delete process.env.EMAIL_BRAND_IMAGE_URL
    else process.env.EMAIL_BRAND_IMAGE_URL = originalBrandImageUrl
    if (originalAdminNotificationsEnabled === undefined) delete process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED
    else process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED = originalAdminNotificationsEnabled
    if (originalAdminEmails === undefined) delete process.env.LIFECYCLE_ADMIN_EMAILS
    else process.env.LIFECYCLE_ADMIN_EMAILS = originalAdminEmails
  })

  it('accepts a minimal payload and writes lead capture', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
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
    expect(schemaMock).toHaveBeenCalledWith('api')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        email: 'buyer@example.com',
        intent: 'demo',
        route: '/pricing',
        source_page: '/pricing',
        form_type: 'demo',
        consent_marketing: false,
        status: 'new',
        device_class: 'mobile',
        viewport_w: 390,
        viewport_h: 844,
        dedupe_key: expect.any(String),
      })
    )
  })

  it('saves successfully when optional email env vars are missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'no-email-env@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as {
      ok?: boolean
      data?: { saved?: boolean; followUp?: { sent?: boolean; reason?: string } }
    }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.followUp?.sent).toBe(false)
    expect(json.data?.followUp?.reason).toBe('email_not_configured')
    expect(sendEmailWithResendMock).not.toHaveBeenCalled()
  })

  it('saves successfully when reply-to env var is invalid', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'team@dazrael.com'
    process.env.RESEND_REPLY_TO_EMAIL = 'invalid-email'
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'replyto@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { followUp?: { sent?: boolean } } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.followUp?.sent).toBe(true)
    expect(sendEmailWithResendMock).toHaveBeenCalledWith(expect.objectContaining({ replyTo: SUPPORT_EMAIL }))
  })

  it('saves successfully when branding image env var is invalid', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'team@dazrael.com'
    process.env.EMAIL_BRAND_IMAGE_URL = 'not-a-valid-url'
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'brand-env@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('saves successfully when admin notifications are misconfigured', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'team@dazrael.com'
    process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED = '1'
    process.env.LIFECYCLE_ADMIN_EMAILS = 'ops@dazrael.com'
    sendEmailDedupedMock.mockImplementation(async (_client, args) => {
      if (args.template === 'admin_lead_capture') {
        throw new Error('admin notification transport failed')
      }
      return { ok: true, status: 'sent', messageId: 'lead-followup' }
    })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'admin-misconfig@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
  })

  it('accepts consent and source metadata', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'ops@example.com',
        name: 'Alex Operator',
        intent: 'pricing_question',
        formType: 'pricing_question',
        route: '/contact',
        sourcePage: '/contact',
        consentMarketing: true,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ops@example.com',
        name: 'Alex Operator',
        form_type: 'pricing_question',
        source_page: '/contact',
        consent_marketing: true,
        consent_timestamp: expect.any(String),
      })
    )
  })

  it('treats duplicate submissions as successful dedupe', async () => {
    insertMock.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'repeat@example.com',
        intent: 'demo',
        route: '/pricing',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { deduped?: boolean; mergedOnDuplicate?: boolean } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.deduped).toBe(true)
    expect(json.data?.mergedOnDuplicate).toBe(false)
  })

  it('continues with anonymous insert when auth lookup throws', async () => {
    getUserMock.mockRejectedValueOnce(new Error('auth lookup timeout'))
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'auth-fallback@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }))
  })

  it('merges useful fields on duplicate submissions when service role is configured', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    insertMock.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    adminMaybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'lead-1',
        user_id: null,
        name: null,
        company: null,
        role: null,
        message: null,
        referrer: null,
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        route: '/pricing',
        source_page: '/pricing',
        consent_marketing: false,
        consent_timestamp: null,
        viewport_w: null,
        viewport_h: null,
        device_class: 'unknown',
      },
      error: null,
    })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'repeat@example.com',
        name: 'Alex Operator',
        company: 'Acme',
        message: 'Need a workflow review',
        intent: 'demo',
        route: '/pricing',
        consentMarketing: true,
        deviceClass: 'mobile',
        viewport: { w: 390, h: 844 },
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { deduped?: boolean; mergedOnDuplicate?: boolean } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.deduped).toBe(true)
    expect(json.data?.mergedOnDuplicate).toBe(true)
    expect(adminUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alex Operator',
        company: 'Acme',
        message: 'Need a workflow review',
        consent_marketing: true,
        consent_timestamp: expect.any(String),
        device_class: 'mobile',
        viewport_w: 390,
        viewport_h: 844,
      })
    )
  })

  it('rejects invalid payloads', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({ email: 'nope', route: '' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 503 when lead capture schema is not ready', async () => {
    insertMock.mockResolvedValueOnce({
      error: { message: 'schema "api" is not exposed' },
    })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'schema@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(503)
    const json = (await res.json()) as { ok?: boolean; error?: { message?: string } }
    expect(json.ok).toBe(false)
    expect(json.error?.message).toContain('Lead capture schema is not ready')
  })

  it('returns 500 for non-schema insert failures', async () => {
    insertMock.mockResolvedValueOnce({
      error: { code: 'XX999', message: 'upstream database error' },
    })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'db-failure@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = (await res.json()) as { ok?: boolean; error?: { code?: string; details?: { reason?: string } } }
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('DATABASE_ERROR')
    expect(json.error?.details?.reason).toBe('LEAD_CAPTURE_INSERT_FAILED')
  })

  it('returns 500 with permission/client failure reason when route client is unavailable', async () => {
    schemaMock.mockImplementationOnce((_schema: string) => ({ from: schemaInsertFromMock }))
    fromMock.mockImplementationOnce(() => ({
      insert: insertMock,
    }))
    insertMock.mockResolvedValueOnce({
      error: { code: 'ROUTE_CLIENT_UNAVAILABLE', message: 'route client unavailable' },
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'client-failure@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = (await res.json()) as { ok?: boolean; error?: { code?: string; details?: { reason?: string } } }
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('DATABASE_ERROR')
    expect(json.error?.details?.reason).toBe('LEAD_CAPTURE_PERMISSION_OR_CLIENT_ERROR')
  })
})

