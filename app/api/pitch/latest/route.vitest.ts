import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getLatestPitchForCompany } from '@/lib/services/pitches'

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', email: 'u@example.com' } }, error: null })),
    },
  })),
}))

vi.mock('@/lib/services/pitches', () => ({
  getLatestPitchForCompany: vi.fn(),
}))

const getLatestPitchForCompanyMock = vi.mocked(getLatestPitchForCompany)

describe('/api/pitch/latest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null pitch when no match', async () => {
    getLatestPitchForCompanyMock.mockResolvedValue(null)
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/pitch/latest?companyDomain=bell.ca', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.pitch).toBe(null)
  })

  it('returns latest pitch when found', async () => {
    getLatestPitchForCompanyMock.mockResolvedValue({
      pitchId: 'p1',
      createdAt: '2025-01-01T00:00:00Z',
      content: 'hello',
      company: {
        leadId: 'l1',
        companyName: 'Bell',
        companyDomain: 'bell.ca',
        companyUrl: 'https://bell.ca',
        emailSequence: null,
        battleCard: null,
      },
    })
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/pitch/latest?companyDomain=bell.ca', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.pitch.content).toBe('hello')
  })
})

