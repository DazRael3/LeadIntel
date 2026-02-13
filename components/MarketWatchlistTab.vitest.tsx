// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => ({ isPro: true }),
}))

vi.mock('@/app/hooks/useMarketWatchlist', () => ({
  useMarketWatchlist: () => ({
    yourWatchlist: [{ symbol: 'AAPL', name: 'Apple', kind: 'stock', defaultVisible: true, order: 1 }],
    starredKeys: new Set(['stock:AAPL']),
    remove: vi.fn(async () => {}),
    loading: false,
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

import { MarketWatchlistTab } from './MarketWatchlistTab'

describe('MarketWatchlistTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchInstrumentQuotes.mockResolvedValue([
      {
        symbol: 'AAPL',
        kind: 'stock',
        price: 123.45,
        changePct: -0.5,
        lastPrice: 123.45,
        changePercent: -0.5,
        change: -0.62,
        currency: 'USD',
        updatedAt: new Date().toISOString(),
      },
    ])
  })

  it('renders starred instruments from shared watchlist hook', async () => {
    render(<MarketWatchlistTab />)
    await waitFor(() => expect(screen.getByTestId('market-watchlist-tab')).toBeInTheDocument())
    expect(screen.getByTestId('market-watchlist-tab-row-AAPL')).toBeInTheDocument()
  })
})

