import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockIsPro = true
const generateWithProviderRouterMock = vi.fn()

vi.mock('@/lib/billing/plan', () => ({
  isPro: vi.fn(async () => mockIsPro),
}))

vi.mock('@/lib/ai/providerRouter', () => ({
  generateWithProviderRouter: generateWithProviderRouterMock,
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
  })),
}))

describe('/api/generate-linkedin-comment', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    mockIsPro = true
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    generateWithProviderRouterMock.mockResolvedValue({
      ok: true,
      provider: 'template',
      model: 'deterministic-template-v1',
      requestId: 'req_1',
      text: 'Nice work!',
    })
  })

  it('unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/generate-linkedin-comment', {
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
    const req = new NextRequest('http://localhost:3000/api/generate-linkedin-comment', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyName: 'Acme', triggerEvent: 'Funding' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('authenticated pro -> returns comment', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/generate-linkedin-comment', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyName: 'Acme', triggerEvent: 'Funding' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.data?.comment).toBe('string')
  })

  it('uses fallback comment when provider chain fails', async () => {
    generateWithProviderRouterMock.mockResolvedValueOnce({
      ok: false,
      provider: 'none',
      model: null,
      text: '',
      errorCode: 'AI_PROVIDERS_UNAVAILABLE',
      requestId: 'req_fallback',
    })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/generate-linkedin-comment', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ companyName: 'Acme', triggerEvent: 'Funding' }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(String(json.data?.comment)).toContain('Congratulations on Funding!')
  })
})
