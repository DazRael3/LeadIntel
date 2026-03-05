import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockInsertError: unknown = null
let mockDeleteError: unknown = null

class FakeQuery {
  private table: string
  private mode: 'insert' | 'delete' | null = null
  constructor(table: string) {
    this.table = table
  }
  insert() {
    this.mode = 'insert'
    return this
  }
  delete() {
    this.mode = 'delete'
    return this
  }
  eq() {
    return this
  }
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ) {
    const value =
      this.table === 'lead_tags' && this.mode === 'insert'
        ? { data: null, error: mockInsertError }
        : this.table === 'lead_tags' && this.mode === 'delete'
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

describe('/api/leads/[leadId]/tags', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    mockInsertError = null
    mockDeleteError = null
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('POST unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/leads/123e4567-e89b-12d3-a456-426614174000/tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ tagId: '123e4567-e89b-12d3-a456-426614174000' }),
    })
    const res = await POST(req, { params: Promise.resolve({ leadId: '123e4567-e89b-12d3-a456-426614174000' }) })
    expect(res.status).toBe(401)
  })

  it('POST authenticated -> ok', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/leads/123e4567-e89b-12d3-a456-426614174000/tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ tagId: '123e4567-e89b-12d3-a456-426614174000' }),
    })
    const res = await POST(req, { params: Promise.resolve({ leadId: '123e4567-e89b-12d3-a456-426614174000' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.success).toBe(true)
  })

  it('DELETE authenticated -> ok', async () => {
    const { DELETE } = await import('./route')
    const req = new NextRequest(
      'http://localhost:3000/api/leads/123e4567-e89b-12d3-a456-426614174000/tags?tagId=123e4567-e89b-12d3-a456-426614174000',
      { method: 'DELETE', headers: { origin: 'http://localhost:3000' } }
    )
    const res = await DELETE(req, { params: Promise.resolve({ leadId: '123e4567-e89b-12d3-a456-426614174000' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.success).toBe(true)
  })
})

