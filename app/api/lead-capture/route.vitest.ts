import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createRouteClient } from '@/lib/supabase/route'
import { renderLeadCaptureConfirmationEmail } from '@/lib/email/internal'

type MockDbError = { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }

const insertMock = vi.fn<(_row: unknown) => Promise<{ error: MockDbError | null } | undefined>>(async () => ({
  error: null,
}))
const getUserMock = vi.fn<
  () => Promise<{ data: { user: { id: string } | null } | null; error: MockDbError | null }>
>(async () => ({ data: { user: null }, error: null }))
const schemaInsertFromMock = vi.fn(() => ({ insert: insertMock }))
const schemaMock = vi.fn((_schema: string) => ({ from: schemaInsertFromMock }))
const fromMock = vi.fn(() => ({ insert: insertMock }))
const adminMaybeSingleMock = vi.fn<() => Promise<{ data: Record<string, unknown> | null; error: MockDbError | null }>>(async () => ({
  data: null,
  error: null,
}))
const adminInsertMock = vi.fn<(_row: unknown) => Promise<{ error: MockDbError | null } | undefined>>(
  async () => ({ error: null })
)
const adminUpdateEqMock = vi.fn<() => Promise<{ error: MockDbError | null }>>(async () => ({ error: null }))
const adminUpdateMock = vi.fn((_updates: Record<string, unknown>) => ({ eq: adminUpdateEqMock }))
const adminSelectEqMock = vi.fn((_column: string, _value: string) => ({ maybeSingle: adminMaybeSingleMock }))
const adminSelectMock = vi.fn((_columns: string) => ({ eq: adminSelectEqMock }))
const adminFromMock = vi.fn((_table: string) => ({
  insert: adminInsertMock,
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

const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
const originalResendApiKey = process.env.RESEND_API_KEY
const originalResendFromEmail = process.env.RESEND_FROM_EMAIL
const originalResendReplyToEmail = process.env.RESEND_REPLY_TO_EMAIL
const originalBrandImageUrl = process.env.EMAIL_BRAND_IMAGE_URL
const originalAdminNotificationsEnabled = process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED
const originalAdminEmails = process.env.LIFECYCLE_ADMIN_EMAILS
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalOpenAiApiKey = process.env.OPENAI_API_KEY
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

vi.mock('openai', () => ({
  default: OpenAIMock,
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
    createOpenAIMock.mockResolvedValue({
      choices: [
        {
          message: {
            content:
              'Practical onboarding sequence for your team\nIdentify one high-signal ICP segment\nLaunch a first trigger-driven workflow\nReview outcomes and optimize daily priorities\nTime-to-value: 1 business day',
          },
        },
      ],
    })
    insertMock.mockResolvedValue({ error: null })
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    fromMock.mockImplementation(() => ({ insert: insertMock }))
    schemaInsertFromMock.mockImplementation(() => ({ insert: insertMock }))
    schemaMock.mockImplementation((_schema: string) => ({ from: schemaInsertFromMock }))
    adminMaybeSingleMock.mockResolvedValue({ data: null, error: null })
    adminInsertMock.mockResolvedValue({ error: null })
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
    delete process.env.OPENAI_API_KEY
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl ?? 'https://example.supabase.co'
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
    if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    if (originalOpenAiApiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalOpenAiApiKey
  })

  it('accepts a minimal payload and writes lead capture', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'team@dazrael.com'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED = '1'
    process.env.LIFECYCLE_ADMIN_EMAILS = 'ops@dazrael.com'
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
    expect(adminInsertMock).toHaveBeenCalledWith(
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
    const followUpCalls = sendEmailDedupedMock.mock.calls
      .map((call) => call[1] as { template?: string; toEmail?: string; subject?: string; text?: string } | undefined)
      .filter((args) => args?.template === 'lead_capture_followup')
    expect(followUpCalls.length).toBeGreaterThan(0)
    expect(
      followUpCalls.some(
        (args) =>
          args?.toEmail === 'buyer@example.com' &&
          typeof args?.subject === 'string' &&
          args.subject.includes('[LeadIntel Demo][') &&
          typeof args?.text === 'string' &&
          args.text.includes('Auto-generated demo outline:')
      )
    ).toBe(true)
    const adminNotificationCalls = sendEmailDedupedMock.mock.calls
      .map((call) => call[1] as { template?: string; text?: string } | undefined)
      .filter((args) => args?.template === 'admin_lead_capture')
    expect(adminNotificationCalls.length).toBeGreaterThan(0)
    expect(
      adminNotificationCalls.some((args) => typeof args?.text === 'string' && args.text.includes('followup_demo_plan_source: ai'))
    ).toBe(true)
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
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
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

  it('always includes support inbox in admin lead notifications', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'team@dazrael.com'
    process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED = '1'
    process.env.LIFECYCLE_ADMIN_EMAILS = 'ops@dazrael.com'
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'admin-inbox-check@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const adminNotificationCalls = sendEmailDedupedMock.mock.calls
      .map((call) => call[1] as { template?: string; toEmail?: string })
      .filter((args) => args.template === 'admin_lead_capture')
    expect(adminNotificationCalls.length).toBeGreaterThan(0)
    expect(adminNotificationCalls.some((args) => args.toEmail === SUPPORT_EMAIL)).toBe(true)
  })

  it('public lead save prefers admin insert when service role is configured', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'admin-first@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; insertClient?: string } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.insertClient).toBe('admin')
    expect(adminInsertMock).toHaveBeenCalledTimes(1)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('falls back to route insert when admin client is unavailable', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    adminInsertMock.mockRejectedValueOnce(new Error('admin transport unavailable'))
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'admin-fallback@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; insertClient?: string } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.insertClient).toBe('route')
    expect(adminInsertMock).toHaveBeenCalledTimes(1)
    expect(insertMock).toHaveBeenCalledTimes(1)
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
    const json = (await res.json()) as {
      ok?: boolean
      data?: { deduped?: boolean; mergedOnDuplicate?: boolean; resultCode?: string }
    }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.deduped).toBe(true)
    expect(json.data?.mergedOnDuplicate).toBe(false)
    expect(json.data?.resultCode).toBe('duplicate_submission')
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

  it('continues when auth lookup returns malformed shape', async () => {
    getUserMock.mockResolvedValueOnce({ error: null, data: null } as never)
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'auth-malformed@example.com',
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

  it('continues when auth getUser requires bound context', async () => {
    const getUserWithContext = vi.fn(function (this: { initializePromise?: Promise<void> }) {
      if (!this?.initializePromise) {
        throw new TypeError("Cannot read properties of undefined (reading 'initializePromise')")
      }
      return Promise.resolve({ data: { user: null }, error: null })
    })
    vi.mocked(createRouteClient).mockImplementationOnce(
      () =>
        ({
          auth: {
            initializePromise: Promise.resolve(),
            getUser: getUserWithContext,
          },
          from: fromMock,
          schema: schemaMock,
        }) as never
    )
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'auth-bound-context@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(getUserWithContext).toHaveBeenCalledTimes(1)
  })

  it('falls back to route insert when admin client is malformed', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    vi.mocked(createSupabaseAdminClient).mockImplementationOnce(() => ({}) as never)
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'admin-malformed-client@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; insertClient?: string } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.insertClient).toBe('route')
  })

  it('returns client misconfigured when route-only client is malformed', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    schemaMock.mockImplementationOnce((_schema: string) => ({}) as never)
    fromMock.mockImplementationOnce(() => ({}) as never)
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'route-malformed-client@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as {
      ok?: boolean
      error?: { code?: string; details?: { reason?: string; insertClient?: string } }
    }
    expect(res.status).toBe(500)
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('DATABASE_ERROR')
    expect(json.error?.details?.reason).toBe('lead_capture_client_misconfigured')
    expect(json.error?.details?.insertClient).toBe('route')
  })

  it('falls back to route insert when admin insert returns malformed result shape', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    adminInsertMock.mockResolvedValueOnce(undefined as never)
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'admin-malformed-result@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; insertClient?: string } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.insertClient).toBe('route')
    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  it('retries admin insert without optional compatibility fields when consent_marketing is missing', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    adminInsertMock
      .mockResolvedValueOnce({
        error: {
          code: 'PGRST204',
          message: "Could not find the 'consent_marketing' column of 'lead_captures' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'schema-cache-retry@example.com',
        intent: 'demo',
        route: '/contact',
        consentMarketing: true,
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; insertClient?: string } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.insertClient).toBe('admin')
    expect(adminInsertMock).toHaveBeenCalledTimes(2)
    const firstInsert = adminInsertMock.mock.calls[0]?.[0] as Record<string, unknown>
    const secondInsert = adminInsertMock.mock.calls[1]?.[0] as Record<string, unknown>
    expect(firstInsert).toHaveProperty('consent_marketing', true)
    expect(firstInsert).toHaveProperty('consent_timestamp')
    expect(firstInsert).toHaveProperty('form_type')
    expect(secondInsert).not.toHaveProperty('consent_marketing')
    expect(secondInsert).not.toHaveProperty('consent_timestamp')
    expect(secondInsert).not.toHaveProperty('form_type')
  })

  it('retries admin insert without optional compatibility fields when consent_timestamp is missing', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    adminInsertMock
      .mockResolvedValueOnce({
        error: {
          code: 'PGRST204',
          message: "Could not find the 'consent_timestamp' column of 'lead_captures' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'schema-cache-retry-ts@example.com',
        intent: 'demo',
        route: '/contact',
        consentMarketing: true,
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; insertClient?: string } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.insertClient).toBe('admin')
    expect(adminInsertMock).toHaveBeenCalledTimes(2)
    const secondInsert = adminInsertMock.mock.calls[1]?.[0] as Record<string, unknown>
    expect(secondInsert).not.toHaveProperty('consent_marketing')
    expect(secondInsert).not.toHaveProperty('consent_timestamp')
    expect(secondInsert).not.toHaveProperty('form_type')
  })

  it('retries admin insert without optional compatibility fields when form_type is missing', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    adminInsertMock
      .mockResolvedValueOnce({
        error: {
          code: 'PGRST204',
          message: "Could not find the 'form_type' column of 'lead_captures' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'schema-cache-retry-formtype@example.com',
        intent: 'demo',
        route: '/contact',
        consentMarketing: true,
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; insertClient?: string } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.insertClient).toBe('admin')
    expect(adminInsertMock).toHaveBeenCalledTimes(2)
    const secondInsert = adminInsertMock.mock.calls[1]?.[0] as Record<string, unknown>
    expect(secondInsert).not.toHaveProperty('consent_marketing')
    expect(secondInsert).not.toHaveProperty('consent_timestamp')
    expect(secondInsert).not.toHaveProperty('form_type')
    expect(secondInsert).toHaveProperty('device_class')
  })

  it('retries admin insert without optional compatibility fields when status is missing', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    adminInsertMock
      .mockResolvedValueOnce({
        error: {
          code: 'PGRST204',
          message: "Could not find the 'status' column of 'lead_captures' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'schema-cache-retry-status@example.com',
        intent: 'demo',
        route: '/contact',
        consentMarketing: true,
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; insertClient?: string } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.insertClient).toBe('admin')
    expect(adminInsertMock).toHaveBeenCalledTimes(2)
    const secondInsert = adminInsertMock.mock.calls[1]?.[0] as Record<string, unknown>
    expect(secondInsert).not.toHaveProperty('consent_marketing')
    expect(secondInsert).not.toHaveProperty('consent_timestamp')
    expect(secondInsert).not.toHaveProperty('form_type')
    expect(secondInsert).not.toHaveProperty('status')
    expect(secondInsert).toHaveProperty('device_class')
  })

  it('retries admin insert without optional compatibility fields when name is missing', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    adminInsertMock
      .mockResolvedValueOnce({
        error: {
          code: 'PGRST204',
          message: "Could not find the 'name' column of 'lead_captures' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'schema-cache-retry-name@example.com',
        name: 'Pat Demo',
        intent: 'demo',
        route: '/contact',
        consentMarketing: true,
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; insertClient?: string } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.insertClient).toBe('admin')
    expect(adminInsertMock).toHaveBeenCalledTimes(2)
    const secondInsert = adminInsertMock.mock.calls[1]?.[0] as Record<string, unknown>
    expect(secondInsert).not.toHaveProperty('consent_marketing')
    expect(secondInsert).not.toHaveProperty('consent_timestamp')
    expect(secondInsert).not.toHaveProperty('form_type')
    expect(secondInsert).not.toHaveProperty('name')
  })

  it('does not trigger optional compatibility fallback for unrelated PGRST204 missing columns', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    adminInsertMock.mockResolvedValueOnce({
      error: {
        code: 'PGRST204',
        message: "Could not find the 'legacy_marker' column of 'lead_captures' in the schema cache",
      },
    })
    insertMock.mockResolvedValueOnce({
      error: {
        code: 'PGRST204',
        message: "Could not find the 'legacy_marker' column of 'lead_captures' in the schema cache",
      },
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'schema-cache-non-consent@example.com',
        intent: 'demo',
        route: '/contact',
        consentMarketing: true,
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; error?: { code?: string; details?: { reason?: string } } }
    expect(res.status).toBe(503)
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('INTERNAL_ERROR')
    expect(json.error?.details?.reason).toBe('lead_capture_schema_not_ready')
    expect(adminInsertMock).toHaveBeenCalledTimes(1)
    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  it('handles supabase methods that require bound context', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

    const adminTableClient = {
      marker: true,
      insert: vi.fn(function (this: { marker?: boolean }, _row: unknown) {
        if (!this?.marker) {
          throw new TypeError("Cannot read properties of undefined (reading 'rest')")
        }
        return Promise.resolve({ error: null })
      }),
    }
    const adminClient = {
      rest: {},
      schema: vi.fn(function (this: { rest?: object }) {
        if (!this?.rest) {
          throw new TypeError("Cannot read properties of undefined (reading 'rest')")
        }
        return this
      }),
      from: vi.fn(function (this: { rest?: object }, _table: string) {
        if (!this?.rest) {
          throw new TypeError("Cannot read properties of undefined (reading 'rest')")
        }
        return adminTableClient
      }),
    }
    vi.mocked(createSupabaseAdminClient).mockImplementationOnce(() => adminClient as never)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'bound-methods@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; insertClient?: string } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.insertClient).toBe('admin')
    expect(adminClient.schema).toHaveBeenCalledWith('api')
    expect(adminClient.from).toHaveBeenCalledWith('lead_captures')
    expect(adminTableClient.insert).toHaveBeenCalledTimes(1)
  })

  it('merges useful fields on duplicate submissions when service role is configured', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    adminInsertMock.mockResolvedValueOnce({
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
    expect(json.error?.details?.reason).toBe('lead_capture_insert_failed')
  })

  it('returns structured permission-denied diagnostics when admin insert fails', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    adminInsertMock.mockResolvedValueOnce({
      error: {
        code: '42501',
        message: 'permission denied for table lead_captures',
        details: 'new row violates row-level security policy',
        hint: 'verify privileges',
      },
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
    const json = (await res.json()) as {
      ok?: boolean
      error?: {
        code?: string
        details?: {
          reason?: string
          insertClient?: string
          insertError?: { code?: string; message?: string; details?: string; hint?: string; schema?: string; table?: string; client?: string }
        }
      }
    }
    expect(res.status).toBe(500)
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('DATABASE_ERROR')
    expect(json.error?.details?.reason).toBe('lead_capture_permission_denied')
    expect(json.error?.details?.insertClient).toBe('admin')
    expect(json.error?.details?.insertError).toEqual(
      expect.objectContaining({
        code: '42501',
        message: 'permission denied for table lead_captures',
        details: 'new row violates row-level security policy',
        hint: 'verify privileges',
        schema: 'api',
        table: 'lead_captures',
        client: 'admin',
      })
    )
  })

  it('does not crash when error object fields are non-string values', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    adminInsertMock.mockResolvedValueOnce({
      error: {
        code: 42501,
        message: { text: 'permission denied' },
        details: ['rls denied'],
        hint: { next: 'check policy' },
      },
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'nonstr-error@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; error?: { details?: { reason?: string } } }
    expect(res.status).toBe(500)
    expect(json.ok).toBe(false)
    expect(json.error?.details?.reason).toBe('lead_capture_insert_failed')
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('does not return 500 when optional follow-up email send fails after save', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'team@dazrael.com'
    sendEmailWithResendMock.mockResolvedValueOnce({ ok: false, errorMessage: 'provider unavailable' })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'followup-failure@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; followUp?: { sent?: boolean; reason?: string } } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.followUp?.sent).toBe(false)
    expect(json.data?.followUp?.reason).toBe('send_failed')
  })

  it('does not crash when follow-up helper returns unexpected shape', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'team@dazrael.com'
    sendEmailWithResendMock.mockResolvedValueOnce(undefined as never)
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'followup-shape@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean; followUp?: { sent?: boolean; reason?: string } } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.saved).toBe(true)
    expect(json.data?.followUp?.sent).toBe(false)
    expect(json.data?.followUp?.reason).toBe('send_failed')
  })

  it('keeps success when duplicate merge helper hits malformed admin shape', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    adminInsertMock.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    vi.mocked(createSupabaseAdminClient)
      .mockImplementationOnce(() => ({ from: adminFromMock }) as never)
      .mockImplementationOnce(() => ({}) as never)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'duplicate-merge-malformed@example.com',
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

  it('does not crash when admin notification helper returns unexpected shape', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'team@dazrael.com'
    process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED = '1'
    process.env.LIFECYCLE_ADMIN_EMAILS = 'ops@dazrael.com'
    sendEmailDedupedMock.mockImplementation(async (_client, args) => {
      if (args.template === 'admin_lead_capture') return undefined as never
      return { ok: true, status: 'sent', messageId: 'followup-ok' }
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'admin-helper-shape@example.com',
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

  it('falls back to deterministic demo plan when AI generation fails', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'team@dazrael.com'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED = '1'
    process.env.LIFECYCLE_ADMIN_EMAILS = 'ops@dazrael.com'
    createOpenAIMock.mockRejectedValueOnce(new Error('provider unavailable'))

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'fallback@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { followUp?: { demoPlanSource?: string; sent?: boolean } } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.followUp?.sent).toBe(true)
    expect(json.data?.followUp?.demoPlanSource).toBe('fallback')
    const followUpCalls = sendEmailDedupedMock.mock.calls
      .map((call) => call[1] as { template?: string; text?: string } | undefined)
      .filter((args) => args?.template === 'lead_capture_followup')
    expect(
      followUpCalls.some(
        (args) => typeof args?.text === 'string' && args.text.includes('Expected time-to-value: 1-2 business days')
      )
    ).toBe(true)
    const adminNotificationCalls = sendEmailDedupedMock.mock.calls
      .map((call) => call[1] as { template?: string; text?: string } | undefined)
      .filter((args) => args?.template === 'admin_lead_capture')
    expect(
      adminNotificationCalls.some(
        (args) => typeof args?.text === 'string' && args.text.includes('followup_demo_plan_source: fallback')
      )
    ).toBe(true)
  })

  it('uses deterministic fallback plan when OpenAI key is missing', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'team@dazrael.com'
    delete process.env.OPENAI_API_KEY

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: leadCaptureHeaders(),
      body: JSON.stringify({
        email: 'no-key@example.com',
        intent: 'demo',
        route: '/contact',
      }),
    })

    const res = await POST(req)
    const json = (await res.json()) as { ok?: boolean; data?: { followUp?: { demoPlanSource?: string; sent?: boolean } } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.followUp?.sent).toBe(true)
    expect(json.data?.followUp?.demoPlanSource).toBe('fallback')
    expect(OpenAIMock).not.toHaveBeenCalled()
  })

  it('keeps transactional CTA rendering intact for non-consent follow-ups', () => {
    const rendered = renderLeadCaptureConfirmationEmail({
      appUrl: 'https://dazrael.com',
      formType: 'demo',
      sourcePage: '/contact',
      consentMarketing: false,
      recipientName: 'Alex',
      company: 'Acme',
      variationSeed: 'seed-1',
    })
    expect(rendered.text).toContain('Support: https://dazrael.com/support')
    expect(rendered.text).not.toContain('Pricing: https://dazrael.com/pricing')
  })
})

