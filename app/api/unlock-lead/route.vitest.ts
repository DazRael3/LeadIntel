import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockIsPro = false
let mockUserRow: { subscription_tier: string | null; last_unlock_date: string | null } | null = {
  subscription_tier: 'free',
  last_unlock_date: null,
}
let mockUpdateError: unknown = null

class FakeQuery {
  private table: string
  private mode: 'select' | 'update' = 'select'
  constructor(table: string) {
    this.table = table
  }
  select() {
    return this
  }
  update() {
    this.mode = 'update'
    return this
  }
  eq() {
    return this
  }
  single() {
    if (this.table === 'users' && this.mode === 'select') {
      return Promise.resolve({ data: mockUserRow, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ) {
    const value =
      this.table === 'users' && this.mode === 'update' ? { data: null, error: mockUpdateError } : { data: null, error: null }
    return Promise.resolve(value).then(onfulfilled as never, onrejected as never)
  }
}

vi.mock('@/lib/billing/plan', () => ({
  isPro: vi.fn(async () => mockIsPro),
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
    from: (table: string) => new FakeQuery(table),
  })),
}))

describe('/api/unlock-lead', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    mockIsPro = false
    mockUserRow = { subscription_tier: 'free', last_unlock_date: null }
    mockUpdateError = null
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/unlock-lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ leadId: '123e4567-e89b-12d3-a456-426614174000' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('pro user -> unlocked', async () => {
    mockIsPro = true
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/unlock-lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ leadId: '123e4567-e89b-12d3-a456-426614174000' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.unlocked).toBe(true)
  })

  it('free user within 24h -> 403', async () => {
    mockUserRow = { subscription_tier: 'free', last_unlock_date: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/unlock-lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ leadId: '123e4567-e89b-12d3-a456-426614174000' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('FORBIDDEN')
  })
})

