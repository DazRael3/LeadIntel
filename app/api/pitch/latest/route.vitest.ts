import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockTier: 'starter' | 'closer' = 'starter'

vi.mock('@/lib/billing/premium-generations', () => ({
  getPremiumGenerationCapabilities: vi.fn(async () => ({
    tier: mockTier,
    maxPremiumGenerations: mockTier === 'starter' ? 3 : null,
    blurPremiumSections: mockTier === 'starter',
    allowPremiumExport: false,
    allowFullCopy: mockTier !== 'starter',
  })),
  getPremiumGenerationUsage: vi.fn(async () => ({ used: 1, limit: 3, remaining: 2, byType: { pitch: 1, report: 0 } })),
  redactTextPreview: (t: string) => t.slice(0, 10),
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', email: 'user@example.com' } }, error: null })),
    },
  })),
}))

vi.mock('@/lib/services/pitches', () => ({
  getLatestPitchForCompany: vi.fn(async () => ({
    pitchId: 'p1',
    createdAt: '2026-01-01T00:00:00.000Z',
    content: 'FULL PREMIUM PITCH CONTENT',
    company: {
      leadId: 'l1',
      companyName: 'Acme',
      companyDomain: 'acme.com',
      companyUrl: 'https://acme.com',
      emailSequence: { part1: 'A', part2: 'B', part3: 'C' },
      battleCard: { currentTech: ['X'], painPoint: 'Y', killerFeature: 'Z' },
    },
  })),
}))

describe('/api/pitch/latest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTier = 'starter'
  })

  it('starter gets redacted latest pitch payload', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/pitch/latest?companyDomain=acme.com', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.isBlurred).toBe(true)
    expect(json.data?.pitch?.content ?? null).toBe(null)
    expect(typeof json.data?.pitch?.contentPreview).toBe('string')
    expect(json.data?.pitch?.company?.emailSequence ?? null).toBe(null)
    expect(json.data?.pitch?.company?.battleCard ?? null).toBe(null)
  })

  it('paid tier gets full latest pitch payload', async () => {
    mockTier = 'closer'
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/pitch/latest?companyDomain=acme.com', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.isBlurred).toBe(false)
    expect(typeof json.data?.pitch?.content).toBe('string')
  })
})

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

