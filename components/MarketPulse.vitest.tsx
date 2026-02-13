// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => ({ isPro: true }),
}))

vi.mock('@/app/hooks/useMarketWatchlist', () => ({
  useMarketWatchlist: () => ({
    allInstruments: [{ symbol: 'AAPL', name: 'Apple', kind: 'stock', defaultVisible: true, order: 1 }],
    yourWatchlist: [{ symbol: 'AAPL', name: 'Apple', kind: 'stock', defaultVisible: true, order: 1 }],
    starredKeys: new Set(['stock:AAPL']),
  }),
}))

const fetchInstrumentQuotes = vi.fn()
vi.mock('@/lib/market/prices', async () => {
  const actual = await vi.importActual<any>('@/lib/market/prices')
  return {
    ...actual,
    fetchInstrumentQuotes: (...args: any[]) => fetchInstrumentQuotes(...args),
  }
})

import { MarketPulse } from './MarketPulse'

describe('MarketPulse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchInstrumentQuotes.mockResolvedValue([
      {
        symbol: 'AAPL',
        kind: 'stock',
        price: 123.45,
        changePct: 1.23,
        lastPrice: 123.45,
        changePercent: 1.23,
        change: 1.5,
        currency: 'USD',
        updatedAt: new Date().toISOString(),
      },
    ])
  })

  it('renders starred and all instruments from shared watchlist hook', async () => {
    render(<MarketPulse />)
    await waitFor(() => expect(screen.getByTestId('market-pulse')).toBeInTheDocument())
    expect(screen.getByTestId('market-pulse-starred-AAPL')).toBeInTheDocument()
    expect(screen.getByTestId('market-pulse-all-AAPL')).toBeInTheDocument()
  })
})

