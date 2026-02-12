// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { MarketTickerBar, computeTickerDuration, mergeTickerInstruments } from './MarketTickerBar'

vi.mock('@/lib/market/prices', () => ({
  fetchInstrumentQuotes: vi.fn(async () => []),
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
  it('renders ticker container and symbols when instruments present', async () => {
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

  it('renders nothing when no instruments', () => {
    const { container } = render(<MarketTickerBar instruments={[]} starredInstruments={[]} />)
    expect(container.textContent || '').toBe('')
  })
})

