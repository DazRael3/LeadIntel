import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockIsPro = true
let mockAiBattleCard: { currentTech?: unknown; painPoint?: unknown; killerFeature?: unknown } = {
  currentTech: ['Stack'],
  painPoint: 'Pain',
  killerFeature: 'Feature',
}

vi.mock('@/lib/billing/plan', () => ({
  isPro: vi.fn(async () => mockIsPro),
}))

vi.mock('@/lib/ai-logic', () => ({
  generateBattleCard: vi.fn(async () => mockAiBattleCard),
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
  })),
}))

describe('/api/generate-battle-card', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    mockIsPro = true
    mockAiBattleCard = { currentTech: ['Stack'], painPoint: 'Pain', killerFeature: 'Feature' }
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    // Default fetch mock for company info fetch
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, text: async () => '' })) as unknown as typeof fetch)
  })

  it('unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/generate-battle-card', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyName: 'Acme' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('authenticated but not pro -> 403', async () => {
    mockIsPro = false
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/generate-battle-card', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyName: 'Acme' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('authenticated pro -> returns battle card fields', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/generate-battle-card', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyName: 'Acme' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data?.techStack)).toBe(true)
    expect(json.data?.techStack).toEqual(['Stack'])
    expect(typeof json.data?.weakness).toBe('string')
    expect(typeof json.data?.whyBetter).toBe('string')
  })

  it('normalizes missing techStack to []', async () => {
    mockAiBattleCard = { painPoint: 'Pain', killerFeature: 'Feature' }
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/generate-battle-card', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyName: 'Acme' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.techStack).toEqual([])
  })
})

