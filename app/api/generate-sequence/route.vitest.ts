import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockIsPro = true

vi.mock('@/lib/billing/plan', () => ({
  isPro: vi.fn(async () => mockIsPro),
}))

vi.mock('@/lib/ai-logic', () => ({
  generateEmailSequence: vi.fn(async () => ({
    email1: 'One',
    email2: 'Two',
    email3: 'Three',
  })),
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
  })),
}))

describe('/api/generate-sequence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    mockIsPro = true
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/generate-sequence', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyName: 'Acme', triggerEvent: 'Funding' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('authenticated but not pro -> 403', async () => {
    mockIsPro = false
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/generate-sequence', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyName: 'Acme', triggerEvent: 'Funding' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('FORBIDDEN')
  })

  it('authenticated pro -> returns sequence', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/generate-sequence', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyName: 'Acme', triggerEvent: 'Funding' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.sequence).toBeTruthy()
  })
})

