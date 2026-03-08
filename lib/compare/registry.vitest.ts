import { describe, expect, it } from 'vitest'
import { COMPARE_PAGES, COMPETITOR_MATRIX } from '@/lib/compare/registry'

describe('compare registry', () => {
  it('includes competitor matrix entries in required order and scores', () => {
    expect(COMPETITOR_MATRIX.map((e) => e.name)).toEqual(['UserGems', 'Common Room', 'ZoomInfo Copilot', 'Apollo', 'LeadIntel'])
    expect(COMPETITOR_MATRIX.map((e) => e.threatScore)).toEqual([9.3, 9.1, 8.8, 8.2, 7.3])
  })

  it('includes modern competitive set compare pages', () => {
    const slugs = new Set(COMPARE_PAGES.map((p) => p.slug))
    expect(slugs.has('leadintel-vs-usergems')).toBe(true)
    expect(slugs.has('leadintel-vs-common-room')).toBe(true)
    expect(slugs.has('leadintel-vs-zoominfo-copilot')).toBe(true)
    expect(slugs.has('leadintel-vs-apollo')).toBe(true)
  })
})

