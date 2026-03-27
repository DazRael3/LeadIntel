import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockCreateUser = vi.fn()
const mockUpdateUserById = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: [] }, error: null }),
        createUser: (...args: unknown[]) => mockCreateUser(...args),
        updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
      },
    },
    schema: () => ({
      from: () => ({
        upsert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'ws_1' }, error: null }),
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }),
    }),
    from: () => ({
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  })),
}))

describe('/api/admin/auth/bootstrap', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.ADMIN_TOKEN = 'adm'
  })

  it('rejects missing admin token', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/admin/auth/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'pw_123456', tier: 'closer' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates/updates user when token present', async () => {
    mockCreateUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    mockUpdateUserById.mockResolvedValueOnce({ data: {}, error: null })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/admin/auth/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': 'adm' },
      body: JSON.stringify({ email: 'a@example.com', password: 'pw_123456', tier: 'closer_plus' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.email).toBe('a@example.com')
    expect(json.data.tier).toBe('closer_plus')
  })
})

