export type PitchCopyViewerTier = 'anonymous' | 'starter' | 'closer' | 'closer_plus' | 'team'

export type ResolvePitchCopyAccessInput = {
  viewerTier: PitchCopyViewerTier
  hasFullPitchAccess: boolean
}

export type ResolvePitchCopyAccessResult =
  | {
      action: 'copy'
      ctaLabel: null
      upgradePath: null
    }
  | {
      action: 'upgrade'
      ctaLabel: 'Upgrade to Pro' | 'Sign up / Upgrade'
      upgradePath: '/pricing?target=closer' | '/signup?redirect=%2Fpricing%3Ftarget%3Dcloser'
    }

type UpgradePath = '/pricing?target=closer' | '/signup?redirect=%2Fpricing%3Ftarget%3Dcloser'

export type ExecutePitchCopyActionInput = {
  access: ResolvePitchCopyAccessResult
  fullText: string
  copyText: (text: string) => Promise<void>
  openUpgrade: (input: { path: UpgradePath; ctaLabel: 'Upgrade to Pro' | 'Sign up / Upgrade' }) => void
}

export type ExecutePitchCopyActionResult = 'copied' | 'upgrade_prompted'

/**
 * Centralized decision for pitch copy actions on gated surfaces.
 * Locked previews must not copy hidden text.
 */
export function resolvePitchCopyAccess(input: ResolvePitchCopyAccessInput): ResolvePitchCopyAccessResult {
  if (input.hasFullPitchAccess) {
    return {
      action: 'copy',
      ctaLabel: null,
      upgradePath: null,
    }
  }

  if (input.viewerTier === 'anonymous') {
    return {
      action: 'upgrade',
      ctaLabel: 'Sign up / Upgrade',
      upgradePath: '/signup?redirect=%2Fpricing%3Ftarget%3Dcloser',
    }
  }

  return {
    action: 'upgrade',
    ctaLabel: 'Upgrade to Pro',
    upgradePath: '/pricing?target=closer',
  }
}

export async function executePitchCopyAction(input: ExecutePitchCopyActionInput): Promise<ExecutePitchCopyActionResult> {
  if (input.access.action === 'upgrade') {
    input.openUpgrade({
      path: input.access.upgradePath,
      ctaLabel: input.access.ctaLabel,
    })
    return 'upgrade_prompted'
  }

  await input.copyText(input.fullText)
  return 'copied'
}
