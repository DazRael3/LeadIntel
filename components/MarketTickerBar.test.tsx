// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { MarketTickerBar, computeTickerDuration, mergeTickerInstruments } from './MarketTickerBar'
import type { InstrumentDefinition } from '@/lib/market/instruments'
import type { InstrumentQuote } from '@/lib/market/prices'

const fetchInstrumentQuotes = vi.fn(async (_instruments: InstrumentDefinition[]): Promise<InstrumentQuote[]> => [])
vi.mock('@/lib/market/prices', () => ({
  fetchInstrumentQuotes: (instruments: InstrumentDefinition[]) => fetchInstrumentQuotes(instruments),
}))

vi.mock('@/components/InstrumentLogo', () => ({
  InstrumentLogo: (props: { symbol: string }) => <span data-testid={`logo-${props.symbol}`} />,
}))

describe('MarketTickerBar helpers', () => {
  it('computeTickerDuration: small symbol count stays readable (12..25s)', () => {
    const d = computeTickerDuration(4)
    expect(d).toBeGreaterThanOrEqual(12)
    expect(d).toBeLessThanOrEqual(25)
  })

  it('computeTickerDuration: large symbol count slows down (30..45s)', () => {
    const d = computeTickerDuration(20)
    expect(d).toBeGreaterThanOrEqual(30)
    expect(d).toBeLessThanOrEqual(45)
  })

  it('mergeTickerInstruments dedupes by symbol (starred wins)', () => {
    const merged = mergeTickerInstruments({
      instruments: [
        { symbol: 'AAPL', kind: 'stock', name: 'Apple', order: 1, defaultVisible: true },
        { symbol: 'MSFT', kind: 'stock', name: 'Microsoft', order: 2, defaultVisible: true },
      ] as any,
      starredInstruments: [{ symbol: 'AAPL', kind: 'stock', name: 'My Apple', order: 99, defaultVisible: false }] as any,
    })

    expect(merged.length).toBe(2)
    const aapl = merged.find((m) => m.symbol === 'AAPL')
    expect(aapl?.name).toBe('My Apple')
  })
})

describe('MarketTickerBar', () => {
  it('respects user preference to hide ticker (localStorage)', async () => {
    window.localStorage.setItem('li_pref_hide_market_ticker', '1')
    render(
      <MarketTickerBar
        instruments={[{ symbol: 'AAPL', kind: 'stock', name: 'Apple', order: 1, defaultVisible: true }] as any}
        starredInstruments={[]}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('market-ticker-hidden')).toBeTruthy()
    expect(fetchInstrumentQuotes).not.toHaveBeenCalled()
  })

  it('renders ticker container and symbols when instruments present', async () => {
    window.localStorage.removeItem('li_pref_hide_market_ticker')
    fetchInstrumentQuotes.mockResolvedValueOnce([
      {
        symbol: 'AAPL',
        kind: 'stock',
        price: 189.12,
        changePct: 1.23,
        lastPrice: 189.12,
        changePercent: 1.23,
        change: 2.31,
        currency: 'USD',
        source: 'provider',
        updatedAt: new Date().toISOString(),
      },
    ])
    render(
      <MarketTickerBar
        instruments={[{ symbol: 'AAPL', kind: 'stock', name: 'Apple', order: 1, defaultVisible: true }] as any}
        starredInstruments={[]}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('market-ticker')).toBeTruthy()
    // Symbol appears at least once (it will be doubled for seamless marquee)
    expect(screen.getAllByText('AAPL').length).toBeGreaterThanOrEqual(1)
  })

  it('allows hiding and showing ticker', async () => {
    window.localStorage.removeItem('li_pref_hide_market_ticker')
    fetchInstrumentQuotes.mockResolvedValueOnce([
      {
        symbol: 'AAPL',
        kind: 'stock',
        price: 189.12,
        changePct: 1.23,
        lastPrice: 189.12,
        changePercent: 1.23,
        change: 2.31,
        currency: 'USD',
        source: 'provider',
        updatedAt: new Date().toISOString(),
      },
    ])
    render(
      <MarketTickerBar
        instruments={[{ symbol: 'AAPL', kind: 'stock', name: 'Apple', order: 1, defaultVisible: true }] as any}
        starredInstruments={[]}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('market-ticker')).toBeTruthy()

    // Hide -> renders hidden banner
    const hide = screen.getByLabelText('Hide market ticker')
    await act(async () => {
      hide.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(screen.getByTestId('market-ticker-hidden')).toBeTruthy()
    expect(window.localStorage.getItem('li_pref_hide_market_ticker')).toBe('1')

    // Show -> returns to ticker
    const show = screen.getByLabelText('Show market ticker')
    await act(async () => {
      show.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(screen.getByTestId('market-ticker')).toBeTruthy()
    expect(window.localStorage.getItem('li_pref_hide_market_ticker')).toBe('0')
  })

  it('formats crypto with more decimals than stocks', async () => {
    fetchInstrumentQuotes.mockResolvedValueOnce([
      {
        symbol: 'AAPL',
        kind: 'stock',
        price: 10,
        changePct: 1,
        lastPrice: 10,
        changePercent: 1,
        change: 0.1,
        currency: 'USD',
        source: 'provider',
        updatedAt: new Date().toISOString(),
      },
      {
        symbol: 'XRP-USD',
        kind: 'crypto',
        price: 0.6,
        changePct: -0.5,
        lastPrice: 0.6,
        changePercent: -0.5,
        change: -0.003,
        currency: 'USD',
        source: 'coingecko',
        updatedAt: new Date().toISOString(),
      },
    ])

    render(
      <MarketTickerBar
        instruments={
          [
            { symbol: 'AAPL', kind: 'stock', name: 'Apple', order: 1, defaultVisible: true },
            { symbol: 'XRP-USD', kind: 'crypto', name: 'XRP', order: 2, defaultVisible: true },
          ] as any
        }
        starredInstruments={[]}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Stock uses 2 decimals; crypto uses more precision.
    expect(screen.getAllByText('$10.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('$0.6000').length).toBeGreaterThanOrEqual(1)
    // Source badges are rendered when provided.
    expect(screen.getAllByTestId('quote-source-AAPL').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('quote-source-XRP-USD').length).toBeGreaterThanOrEqual(1)
  })

  it('renders data source label when provided', async () => {
    fetchInstrumentQuotes.mockResolvedValueOnce([
      {
        symbol: 'AAPL',
        kind: 'stock',
        price: 123.45,
        changePct: 1.23,
        lastPrice: 123.45,
        changePercent: 1.23,
        change: 1.5,
        currency: 'USD',
        source: 'provider',
        updatedAt: new Date().toISOString(),
      },
    ])

    render(
      <MarketTickerBar
        instruments={[{ symbol: 'AAPL', kind: 'stock', name: 'Apple', order: 1, defaultVisible: true }] as any}
        starredInstruments={[]}
        dataSourceLabel="Finnhub"
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByLabelText(/data by coingecko \/ finnhub/i)).toBeTruthy()
    expect(screen.getByText(/Data by CoinGecko/i)).toBeTruthy()
    expect(screen.getByText(/Finnhub/i)).toBeTruthy()
  })

  it('renders base CoinGecko label even when dataSourceLabel is null', async () => {
    fetchInstrumentQuotes.mockResolvedValueOnce([
      {
        symbol: 'AAPL',
        kind: 'stock',
        price: 123.45,
        changePct: 1.23,
        lastPrice: 123.45,
        changePercent: 1.23,
        change: 1.5,
        currency: 'USD',
        source: 'provider',
        updatedAt: new Date().toISOString(),
      },
    ])

    render(
      <MarketTickerBar
        instruments={[{ symbol: 'AAPL', kind: 'stock', name: 'Apple', order: 1, defaultVisible: true }] as any}
        starredInstruments={[]}
        dataSourceLabel={null}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText(/Data by CoinGecko/i)).toBeTruthy()
    expect(screen.queryByText(/Dev\s*\/\s*Mock/i)).toBeNull()
  })

  it('renders CoinGecko label with dev suffix', async () => {
    fetchInstrumentQuotes.mockResolvedValueOnce([
      {
        symbol: 'AAPL',
        kind: 'stock',
        price: 123.45,
        changePct: 1.23,
        lastPrice: 123.45,
        changePercent: 1.23,
        change: 1.5,
        currency: 'USD',
        source: 'provider',
        updatedAt: new Date().toISOString(),
      },
    ])

    render(
      <MarketTickerBar
        instruments={[{ symbol: 'AAPL', kind: 'stock', name: 'Apple', order: 1, defaultVisible: true }] as any}
        starredInstruments={[]}
        dataSourceLabel="Dev / Mock"
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText(/Data by CoinGecko\s*\/\s*Dev\s*\/\s*Mock/i)).toBeTruthy()
  })

  it('renders nothing when no instruments', () => {
    const { container } = render(<MarketTickerBar instruments={[]} starredInstruments={[]} />)
    expect(container.textContent || '').toBe('')
  })
})

