import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { useMarketWatchlist } from '@/app/dashboard/hooks/useMarketWatchlist'
import { MarketPulseTicker } from './MarketPulseTicker'

vi.mock('@/app/dashboard/hooks/useMarketWatchlist', () => ({
  useMarketWatchlist: vi.fn(),
}))

const useMarketWatchlistMock = vi.mocked(useMarketWatchlist)

describe('MarketPulseTicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders two copies of items for seamless marquee', () => {
    useMarketWatchlistMock.mockReturnValue({
      isPro: false,
      loading: false,
      error: null,
      customItems: [],
      resolved: [
        { symbol: 'AAPL', type: 'stock' },
        { symbol: 'MSFT', type: 'stock' },
        { symbol: 'BTC', type: 'crypto' },
      ],
      refresh: vi.fn(),
      save: vi.fn(),
    })

    render(<MarketPulseTicker />)
    expect(screen.getByTestId('market-ticker')).toBeTruthy()

    // 3 symbols duplicated => 6 rendered items
    expect(screen.getAllByTestId('ticker-item')).toHaveLength(6)
    expect(screen.getAllByText('AAPL')).toHaveLength(2)
  })

  it('does not explode on empty symbol list', () => {
    useMarketWatchlistMock.mockReturnValue({
      isPro: false,
      loading: false,
      error: null,
      customItems: [],
      resolved: [],
      refresh: vi.fn(),
      save: vi.fn(),
    })

    render(<MarketPulseTicker />)
    expect(screen.getByText('No symbols')).toBeTruthy()
    expect(screen.queryAllByTestId('ticker-item')).toHaveLength(0)
  })

  it('shows a placeholder when market data fails', () => {
    useMarketWatchlistMock.mockReturnValue({
      isPro: false,
      loading: false,
      error: 'boom',
      customItems: [],
      resolved: [],
      refresh: vi.fn(),
      save: vi.fn(),
    })

    render(<MarketPulseTicker />)
    expect(screen.getByText('Market data unavailable')).toBeTruthy()
  })
})

