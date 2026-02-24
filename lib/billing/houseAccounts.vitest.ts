import { describe, expect, it } from 'vitest'

import { isHouseCloserEmail, parseHouseCloserEmails } from './houseAccounts'

describe('house accounts', () => {
  it('parseHouseCloserEmails splits, trims, lowercases', () => {
    expect(parseHouseCloserEmails('a@x.com, b@y.com')).toEqual(['a@x.com', 'b@y.com'])
  })

  it('isHouseCloserEmail matches case-insensitively', () => {
    expect(isHouseCloserEmail('A@X.com', 'a@x.com')).toBe(true)
  })

  it('isHouseCloserEmail returns false when not present', () => {
    expect(isHouseCloserEmail('other@foo.com', 'a@x.com,b@y.com')).toBe(false)
  })
})

