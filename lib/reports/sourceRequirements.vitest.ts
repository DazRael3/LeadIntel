import { describe, expect, it } from 'vitest'
import { assertMinCitationsOrThrow, countUniqueCitations } from './sourceRequirements'

describe('sourceRequirements', () => {
  it('counts unique citations and throws when below minimum', () => {
    expect(countUniqueCitations([{ url: 'https://a.com' }])).toBe(1)
    expect(() => assertMinCitationsOrThrow([{ url: 'https://a.com' }])).toThrow('NO_SOURCES_FOUND')
    expect(() => assertMinCitationsOrThrow([{ url: 'https://a.com' }, { url: 'https://b.com' }])).not.toThrow()
  })
})

