'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { fetchInstrumentQuotes, type InstrumentQuote } from '@/lib/market/prices'
import { formatDistanceToNow } from 'date-fns'
import { InstrumentLogo } from '@/components/InstrumentLogo'
import type { InstrumentDefinition } from '@/lib/market/instruments'
import { getQuotePriceDecimals } from '@/lib/market/quotes'

type QuoteMap = Record<string, InstrumentQuote>

function toQuoteMap(quotes: InstrumentQuote[]): QuoteMap {
  const map: QuoteMap = {}
  for (const q of quotes) {
    map[q.symbol] = q
  }
  return map
}

export type MarketTickerInstrument = InstrumentDefinition

export interface MarketTickerBarProps {
  instruments: MarketTickerInstrument[]
  starredInstruments?: MarketTickerInstrument[]
}

export function computeTickerDuration(symbolCount: number): number {
  const count = Math.max(0, Math.floor(symbolCount))
  const baseSeconds = 18
  let durationSec = baseSeconds + (count - 6) * 1.5
  durationSec = Math.max(12, Math.min(45, durationSec))
  // keep stable + readable
  return Math.round(durationSec)
}

export function mergeTickerInstruments(args: {
  instruments: MarketTickerInstrument[]
  starredInstruments?: MarketTickerInstrument[]
}): MarketTickerInstrument[] {
  const map = new Map<string, MarketTickerInstrument>()
  for (const item of args.instruments ?? []) {
    if (!item?.symbol) continue
    map.set(item.symbol, item)
  }
  for (const item of args.starredInstruments ?? []) {
    if (!item?.symbol) continue
    // last one wins (starred overrides core)
    map.set(item.symbol, item)
  }
  return Array.from(map.values())
}

export function MarketTickerBar({ instruments, starredInstruments }: MarketTickerBarProps) {
  const mergedInstruments = useMemo(
    () => mergeTickerInstruments({ instruments, starredInstruments }),
    [instruments, starredInstruments]
  )

  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (mergedInstruments.length === 0) return
    let cancelled = false

    const refresh = async () => {
      try {
        const next = await fetchInstrumentQuotes(mergedInstruments)
        if (cancelled) return
        setQuotes(toQuoteMap(next))
        setLastUpdatedAt(next.map((q) => q.updatedAt).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null)
        setError(null)
      } catch {
        if (cancelled) return
        setError('Market data unavailable')
      }
    }

    void refresh()
    const interval = setInterval(refresh, 45000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [mergedInstruments])

  const doubled = useMemo(() => [...mergedInstruments, ...mergedInstruments], [mergedInstruments])
  const durationSec = computeTickerDuration(mergedInstruments.length)

  if (mergedInstruments.length === 0) return null

  return (
    <div
      className="group relative w-full overflow-hidden border-b border-cyan-500/20 bg-background/90 backdrop-blur-sm"
      data-testid="market-ticker"
    >
      {error ? <div className="px-6 py-2 text-xs text-muted-foreground">{error}</div> : null}
      <div className="flex items-center gap-3">
        <div className="flex-1 overflow-hidden">
          <div
            className="flex w-max shrink-0 animate-scroll motion-reduce:animate-none group-hover:[animation-play-state:paused] will-change-transform"
            style={{
              animationDuration: `${durationSec}s`,
              // Tailwind animation uses this CSS var.
              ['--ticker-duration' as any]: `${durationSec}s`,
            }}
            aria-label="Market ticker"
          >
            {doubled.map((inst, idx) => {
              const q = quotes[inst.symbol]
              const changePercent = q?.changePercent ?? null
              const price = q?.lastPrice ?? null
              const kind = q?.kind ?? inst.kind
              const source = q?.source ?? null

              return (
                <div
                  key={idx < mergedInstruments.length ? inst.symbol : `${inst.symbol}:dup`}
                  className="flex items-center gap-3 px-5 sm:px-6 py-2.5 sm:py-3 whitespace-nowrap border-r border-cyan-500/10"
                >
                  <InstrumentLogo symbol={inst.symbol} logoUrl={q?.logoUrl} size={18} className="shrink-0" />
                  <span className="font-bold bloomberg-font text-cyan-400 text-sm sm:text-base md:text-[15px]">
                    {inst.symbol}
                  </span>
                  {source === 'provider' || source === 'coingecko' ? (
                    <span
                      className="rounded border border-cyan-500/20 bg-cyan-500/5 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      title={source === 'provider' ? 'Source: live market data provider' : 'Source: CoinGecko (USD)'}
                      aria-label={source === 'provider' ? 'Source provider' : 'Source CoinGecko'}
                      data-testid={`quote-source-${inst.symbol}`}
                    >
                      {source === 'provider' ? 'LIVE' : 'CG'}
                    </span>
                  ) : null}
                  <span className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                    {price == null ? '—' : `$${price.toFixed(getQuotePriceDecimals(kind, price))}`}
                  </span>
                  <div className="flex items-center gap-1">
                    {changePercent == null ? null : changePercent >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-400" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-400" />
                    )}
                    <span
                      className={`text-xs sm:text-sm font-medium tabular-nums ${
                        changePercent == null
                          ? 'text-muted-foreground'
                          : changePercent > 0
                            ? 'text-green-400'
                            : changePercent < 0
                              ? 'text-red-400'
                              : 'text-muted-foreground'
                      }`}
                    >
                      {changePercent == null
                        ? '—'
                        : `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {lastUpdatedAt ? (
          <div className="hidden sm:block px-4 py-2 text-[11px] text-muted-foreground whitespace-nowrap">
            Updated {formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

