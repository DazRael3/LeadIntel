import { describe, it, expect } from 'vitest'

import { makeNameCompanyKey } from './company-key'

describe('makeNameCompanyKey', () => {
  it('slugifies and prefixes a simple name', () => {
    expect(makeNameCompanyKey('Redpath')).toBe('name__redpath')
  })

  it('slugifies punctuation and spaces', () => {
    expect(makeNameCompanyKey('Microsoft Corp.')).toBe('name__microsoft-corp')
  })

  it('trims and lowercases', () => {
    expect(makeNameCompanyKey('   Big   CO   ')).toBe('name__big-co')
  })
})

