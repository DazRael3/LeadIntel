'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { fetchInstrumentQuotes, type InstrumentQuote } from '@/lib/market/prices'
import { formatDistanceToNow } from 'date-fns'
import { InstrumentLogo } from '@/components/InstrumentLogo'
import type { InstrumentDefinition } from '@/lib/market/instruments'
import { getQuotePriceDecimals } from '@/lib/market/quotes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDocumentVisibility } from '@/app/hooks/useDocumentVisibility'

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
  dataSourceLabel?: string | null
}

const LS_HIDE_MARKET_TICKER = 'li_pref_hide_market_ticker'

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

export function MarketTickerBar({ instruments, starredInstruments, dataSourceLabel = null }: MarketTickerBarProps) {
  const mergedInstruments = useMemo(
    () => mergeTickerInstruments({ instruments, starredInstruments }),
    [instruments, starredInstruments]
  )

  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(LS_HIDE_MARKET_TICKER) === '1'
    } catch {
      return false
    }
  })
  const visible = useDocumentVisibility()

  useEffect(() => {
    if (mergedInstruments.length === 0) return
    if (!visible) return
    if (hidden) return
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
  }, [mergedInstruments, visible, hidden])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const has = document.cookie.includes('li_review_mode=1')
    setReviewMode(has)
  }, [])

  const doubled = useMemo(() => [...mergedInstruments, ...mergedInstruments], [mergedInstruments])
  const durationSec = computeTickerDuration(mergedInstruments.length)

  if (mergedInstruments.length === 0) return null

  const suffix = typeof dataSourceLabel === 'string' && dataSourceLabel.trim().length > 0 ? dataSourceLabel.trim() : null

  if (hidden) {
    return (
      <div
        className="w-full border-b border-cyan-500/20 bg-background/90 backdrop-blur-sm"
        data-testid="market-ticker-hidden"
        aria-label="Market ticker hidden"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 text-xs text-muted-foreground">
          <span>Market ticker hidden</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            onClick={() => {
              const next = false
              setHidden(next)
              try {
                window.localStorage.setItem(LS_HIDE_MARKET_TICKER, next ? '1' : '0')
              } catch {
                // ignore: preference is optional
              }
            }}
            aria-label="Show market ticker"
          >
            Show
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group relative w-full overflow-hidden border-b border-cyan-500/20 bg-background/90 backdrop-blur-sm"
      data-testid="market-ticker"
    >
      {error ? <div className="px-6 py-2 text-xs text-muted-foreground">{error}</div> : null}
      <div className="flex items-center gap-3">
        <div className="flex-1 overflow-hidden">
          <div
            className="flex w-max shrink-0 animate-scroll group-hover:[animation-play-state:paused] will-change-transform"

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
        <div className="hidden md:flex items-center gap-2 px-4 py-2 text-[11px] text-muted-foreground whitespace-nowrap">
          {reviewMode ? (
            <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-[10px]">
              Review Mode
            </Badge>
          ) : null}
          {lastUpdatedAt ? (
            <span>Updated {formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true })}</span>
          ) : null}
          {lastUpdatedAt ? <span className="text-slate-700">•</span> : null}
          <span
            className="rounded-full bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-400"
            title={suffix ? `Market data source: CoinGecko / ${suffix} (USD).` : 'Market data source: CoinGecko (USD).'}
            aria-label={
              suffix
                ? `Market data source: Data by CoinGecko / ${suffix}, all prices in USD.`
                : 'Market data source: Data by CoinGecko, all prices in USD.'
            }
          >
            Data by CoinGecko{suffix ? ` / ${suffix}` : ''}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            onClick={() => {
              const next = !hidden
              setHidden(next)
              try {
                window.localStorage.setItem(LS_HIDE_MARKET_TICKER, next ? '1' : '0')
              } catch {
                // ignore: preference is optional
              }
            }}
            aria-label={hidden ? 'Show market ticker' : 'Hide market ticker'}
          >
            {hidden ? 'Show' : 'Hide'}
          </Button>
        </div>
      </div>
    </div>
  )
}

