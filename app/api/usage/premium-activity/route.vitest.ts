import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/billing/premium-generations', () => ({
  getPremiumGenerationCapabilities: vi.fn(async () => ({
    tier: 'starter',
    maxPremiumGenerations: 3,
    usageScope: 'shared_across_pitches_and_reports',
    previewOnlyOnFree: true,
    blurPremiumSections: true,
    allowPremiumExport: false,
    allowFullCopy: false,
    allowFullPitchAccessOnFree: false,
    allowFullReportAccessOnFree: false,
    freeGenerationLabel: 'Free plan: 3 preview generations total',
    freeGenerationHelper: 'Generate up to 3 pitch/report previews on Free.',
    freeUsageScopeLabel: 'Usage is shared across pitches and reports.',
    lockedHelper: 'Full premium content stays locked until you upgrade.',
  })),
}))

vi.mock('@/lib/billing/premium-activity', () => ({
  getRecentPremiumActivity: vi.fn(async () => [
    {
      assetType: 'pitch',
      objectId: 'pitch_1',
      title: 'Acme',
      companyName: 'Acme',
      companyDomain: 'acme.com',
      createdAt: new Date().toISOString(),
      status: 'preview_locked',
      statusLabel: 'Preview locked',
      sourceSurface: 'pitch',
      primaryAction: { label: 'View pitch page', href: '/pitch?url=acme.com&name=Acme' },
      upgradeAction: { label: 'Upgrade', href: '/pricing?target=closer' },
    },
  ]),
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', email: 'user@example.com' } }, error: null })),
    },
  })),
}))

describe('GET /api/usage/premium-activity', () => {
  it('returns recent premium activity items', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/usage/premium-activity', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data?.items)).toBe(true)
    expect(json.data.items[0]?.assetType).toBe('pitch')
  })
})

