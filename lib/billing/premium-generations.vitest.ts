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
    expect(caps.usageScope).toBe('separate_pitch_and_report_caps')
    expect(caps.previewOnlyOnFree).toBe(true)
    expect(caps.blurPremiumSections).toBe(true)
    expect(caps.allowFullPitchAccessOnFree).toBe(false)
    expect(caps.allowFullReportAccessOnFree).toBe(false)

    expect(caps.freeGenerationLabel).toBe('Starter: 3 pitch previews + 3 report previews')
    expect(caps.freeGenerationHelper).toBe('Generate up to 3 pitch previews and up to 3 report previews on Starter.')
    expect(caps.freeUsageScopeLabel).toBe('Pitch and report preview limits are tracked separately.')
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

