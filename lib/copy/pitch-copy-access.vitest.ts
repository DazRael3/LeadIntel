import { describe, expect, it, vi } from 'vitest'
import { executePitchCopyAction, resolvePitchCopyAccess } from '@/lib/copy/pitch-copy-access'

describe('pitch copy access', () => {
  it('prompts Upgrade to Pro for starter users on locked copy', async () => {
    const access = resolvePitchCopyAccess({ viewerTier: 'starter', hasFullPitchAccess: false })
    const copyText = vi.fn(async (_text: string) => {})
    const openUpgrade = vi.fn()

    const result = await executePitchCopyAction({
      access,
      fullText: 'hidden full pitch',
      copyText,
      openUpgrade,
    })

    expect(result).toBe('upgrade_prompted')
    expect(copyText).not.toHaveBeenCalled()
    expect(openUpgrade).toHaveBeenCalledWith({
      ctaLabel: 'Upgrade to Pro',
      path: '/pricing?target=closer',
    })
  })

  it('prompts sign up / upgrade for anonymous users on locked copy', async () => {
    const access = resolvePitchCopyAccess({ viewerTier: 'anonymous', hasFullPitchAccess: false })
    const copyText = vi.fn(async (_text: string) => {})
    const openUpgrade = vi.fn()

    const result = await executePitchCopyAction({
      access,
      fullText: 'hidden full pitch',
      copyText,
      openUpgrade,
    })

    expect(result).toBe('upgrade_prompted')
    expect(copyText).not.toHaveBeenCalled()
    expect(openUpgrade).toHaveBeenCalledWith({
      ctaLabel: 'Sign up / Upgrade',
      path: '/signup?redirect=%2Fpricing%3Ftarget%3Dcloser',
    })
  })

  it('copies full pitch for paid users with access', async () => {
    const access = resolvePitchCopyAccess({ viewerTier: 'closer', hasFullPitchAccess: true })
    const copyText = vi.fn(async (_text: string) => {})
    const openUpgrade = vi.fn()

    const result = await executePitchCopyAction({
      access,
      fullText: 'full paid pitch',
      copyText,
      openUpgrade,
    })

    expect(result).toBe('copied')
    expect(copyText).toHaveBeenCalledWith('full paid pitch')
    expect(openUpgrade).not.toHaveBeenCalled()
  })
})
