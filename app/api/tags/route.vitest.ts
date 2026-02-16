import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockTags: Array<{ id: string; name: string; created_at: string }> = []
let mockUpsertedTag: { id: string; name: string; name_ci?: string; created_at: string } | null = null
let mockDeleteError: unknown = null

class FakeQuery {
  private table: string
  private mode: 'select' | 'upsert' | 'delete' = 'select'

  constructor(table: string) {
    this.table = table
  }

  select() {
    return this
  }
  eq() {
    return this
  }
  order() {
    return this
  }

  upsert() {
    this.mode = 'upsert'
    return this
  }
  delete() {
    this.mode = 'delete'
    return this
  }

  single() {
    if (this.table !== 'tags' || this.mode !== 'upsert') {
      return Promise.resolve({ data: null, error: null })
    }
    return Promise.resolve({ data: mockUpsertedTag, error: null })
  }

  // Allow `await supabase.from(...).select(...).eq(...)` style.
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ) {
    const value =
      this.table === 'tags' && this.mode === 'select'
        ? { data: mockTags, error: null }
        : this.table === 'tags' && this.mode === 'delete'
          ? { data: null, error: mockDeleteError }
          : { data: null, error: null }

    return Promise.resolve(value).then(onfulfilled as never, onrejected as never)
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

describe('/api/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    mockTags = [
      { id: randomUUID(), name: 'A', created_at: new Date().toISOString() },
      { id: randomUUID(), name: 'B', created_at: new Date().toISOString() },
    ]
    mockUpsertedTag = { id: randomUUID(), name: 'New', name_ci: 'new', created_at: new Date().toISOString() }
    mockDeleteError = null
  })

  it('GET unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/tags', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('UNAUTHORIZED')
  })

  it('GET authenticated -> returns tags', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/tags', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data?.items)).toBe(true)
    expect(json.data.items).toHaveLength(2)
  })

  it('POST unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ name: 'X' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('UNAUTHORIZED')
  })

  it('POST authenticated -> creates tag', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ name: 'New' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.item?.name).toBe('New')
  })

  it('DELETE unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { DELETE } = await import('./route')
    const req = new NextRequest(`http://localhost:3000/api/tags?id=${randomUUID()}`, {
      method: 'DELETE',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await DELETE(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('UNAUTHORIZED')
  })

  it('DELETE authenticated -> ok', async () => {
    const { DELETE } = await import('./route')
    const req = new NextRequest(`http://localhost:3000/api/tags?id=${randomUUID()}`, {
      method: 'DELETE',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.success).toBe(true)
  })
})

