import { describe, expect, it } from 'vitest'
import { VERTICALS, VERTICAL_LIST } from '@/lib/verticals/registry'
import { VERTICAL_USE_CASES } from '@/lib/verticals/use-cases'

describe('vertical registry', () => {
  it('exposes a bounded non-empty set', () => {
    expect(VERTICAL_LIST.length).toBeGreaterThanOrEqual(3)
  })

  it('every vertical references valid use-cases', () => {
    const keys = new Set(Object.keys(VERTICAL_USE_CASES))
    for (const v of Object.values(VERTICALS)) {
      for (const u of v.useCases) {
        expect(keys.has(u)).toBe(true)
      }
    }
  })
})

