import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockUpserted: { user_id: string; autopilot_enabled: boolean; updated_at: string } | null = null

class FakeQuery {
  private table: string
  constructor(table: string) {
    this.table = table
  }
  upsert() {
    return this
  }
  select() {
    return this
  }
  single() {
    if (this.table === 'user_settings') {
      return Promise.resolve({ data: mockUpserted, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }
}

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
    from: (table: string) => new FakeQuery(table),
  })),
}))

describe('/api/settings/autopilot', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    mockUpserted = { user_id: 'user_1', autopilot_enabled: true, updated_at: new Date().toISOString() }
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/settings/autopilot', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ enabled: true }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('authenticated -> upserts settings', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/settings/autopilot', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ enabled: true }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.settings?.user_id).toBe('user_1')
  })
})

