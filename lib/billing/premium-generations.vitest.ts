import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/team/gating', () => ({
  getUserTierForGating: vi.fn(),
}))

import { getUserTierForGating } from '@/lib/team/gating'
import { getPremiumGenerationCapabilities } from '@/lib/billing/premium-generations'

describe('premium generations capabilities (presentation-safe)', () => {
  it('starter gets preview-only wording and flags', async () => {
    ;(getUserTierForGating as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('starter')
    const caps = await getPremiumGenerationCapabilities({ supabase: {} as any, userId: 'u', sessionEmail: 'x@example.com' })

    expect(caps.maxPremiumGenerations).toBe(3)
    expect(caps.usageScope).toBe('shared_across_pitches_and_reports')
    expect(caps.previewOnlyOnFree).toBe(true)
    expect(caps.blurPremiumSections).toBe(true)
    expect(caps.allowFullPitchAccessOnFree).toBe(false)
    expect(caps.allowFullReportAccessOnFree).toBe(false)

    expect(caps.freeGenerationLabel).toBe('Free plan: 3 preview generations total')
    expect(caps.freeGenerationHelper).toBe('Generate up to 3 pitch/report previews on Free.')
    expect(caps.freeUsageScopeLabel).toBe('Usage is shared across pitches and reports.')
    expect(caps.lockedHelper).toBe('Full premium content stays locked until you upgrade.')
  })

  it('paid tier has no free preview copy', async () => {
    ;(getUserTierForGating as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('closer')
    const caps = await getPremiumGenerationCapabilities({ supabase: {} as any, userId: 'u', sessionEmail: 'x@example.com' })

    expect(caps.previewOnlyOnFree).toBe(false)
    expect(caps.blurPremiumSections).toBe(false)
    expect(caps.freeGenerationLabel).toBe(null)
    expect(caps.freeGenerationHelper).toBe(null)
    expect(caps.freeUsageScopeLabel).toBe(null)
    expect(caps.lockedHelper).toBe(null)
  })
})

