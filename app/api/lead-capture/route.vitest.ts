import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const insertMock = vi.fn<(_row: unknown) => Promise<{ error: { code?: string; message?: string } | null }>>(async () => ({
  error: null,
}))
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
const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
    from: vi.fn(() => ({
      insert: insertMock,
    })),
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: adminFromMock,
  })),
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
    adminMaybeSingleMock.mockResolvedValue({ data: null, error: null })
    adminUpdateEqMock.mockResolvedValue({ error: null })
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  afterAll(() => {
    if (originalServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole
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

  it('accepts consent and source metadata', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
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
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
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
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
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
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
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
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
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
})

