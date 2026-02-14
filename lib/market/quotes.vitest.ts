import { describe, expect, it } from 'vitest'
import { allQuotesAreUsd } from './quotes'

describe('market quotes helpers', () => {
  it('allQuotesAreUsd returns true when all are USD', () => {
    expect(allQuotesAreUsd([{ currency: 'USD' }, { currency: 'USD' }])).toBe(true)
  })

  it('allQuotesAreUsd returns false when any currency is non-USD', () => {
    // Cast: MarketQuote.currency is a literal "USD" at type level, but this tests runtime defensiveness.
    expect(allQuotesAreUsd([{ currency: 'USD' }, { currency: 'EUR' as unknown as 'USD' }])).toBe(false)
  })
})

