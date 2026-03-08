import type { VerticalKey } from './types'
import { VERTICALS } from './registry'

export type VerticalMessaging = {
  headline: string
  subhead: string
  bestForLabel: string
  notBestForLabel: string
  disclaimer: string
}

export function getVerticalMessaging(key: VerticalKey): VerticalMessaging {
  const v = VERTICALS[key]
  const support =
    v.supportLevel === 'supported'
      ? 'Supported workflow fit'
      : v.supportLevel === 'vertical_friendly'
        ? 'Vertical-friendly workflow fit'
        : 'Not yet supported'

  return {
    headline: `${v.label} — ${support}`,
    subhead: v.shortDescription,
    bestForLabel: 'Best for',
    notBestForLabel: 'Not best for',
    disclaimer:
      'LeadIntel is intentionally workflow-focused. Vertical fit reflects messaging and operational surfaces available in the product—not claims of deep industry coverage.',
  }
}

