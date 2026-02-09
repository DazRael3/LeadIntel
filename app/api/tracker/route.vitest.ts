import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockSettingsRow: { user_id: string } | null = { user_id: 'user_1' }
let mockInsertError: unknown = null

class AdminQuery {
  private table: string
  constructor(table: string) {
    this.table = table
  }
  select() {
    return this
  }
  eq() {
    return this
  }
  maybeSingle() {
    if (this.table === 'user_settings') {
      return Promise.resolve({ data: mockSettingsRow, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }
  insert() {
    return Promise.resolve({ error: mockInsertError })
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => new AdminQuery(table),
  })),
}))

describe('/api/tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingsRow = { user_id: 'user_1' }
    mockInsertError = null
    delete process.env.CLEARBIT_REVEAL_API_KEY
  })

  it('GET returns embeddable script', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/tracker?k=abc', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/javascript')
    const text = await res.text()
    expect(text).toContain('/api/tracker')
  })

  it('POST invalid body -> 400', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/tracker', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('VALIDATION_ERROR')
  })

  it('POST valid body but unknown trackerKey -> 401', async () => {
    mockSettingsRow = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/tracker', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trackerKey: '123e4567-e89b-12d3-a456-426614174000' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('UNAUTHORIZED')
  })

  it('POST valid body -> 200 tracked', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/tracker', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trackerKey: '123e4567-e89b-12d3-a456-426614174000' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tracked).toBe(true)
  })
})

