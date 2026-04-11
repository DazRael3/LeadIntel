import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const insertMock = vi.fn<(_row: unknown) => Promise<{ error: { code?: string; message?: string } | null }>>(async () => ({
  error: null,
}))

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
    const json = (await res.json()) as { ok?: boolean; data?: { deduped?: boolean } }
    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data?.deduped).toBe(true)
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

