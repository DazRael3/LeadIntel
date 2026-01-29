'use client'

import { useEffect, useMemo, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { fetchInstrumentQuotes, type InstrumentQuote } from '@/lib/market/prices'
import { useMarketWatchlist } from '@/app/hooks/useMarketWatchlist'
import { formatDistanceToNow } from 'date-fns'

type QuoteMap = Record<string, InstrumentQuote>

function toQuoteMap(quotes: InstrumentQuote[]): QuoteMap {
  const map: QuoteMap = {}
  for (const q of quotes) {
    map[q.symbol] = q
  }
  return map
}

export function MarketTickerBar() {
  const { tickerInstruments: instruments, error: watchlistError } = useMarketWatchlist()

  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const next = await fetchInstrumentQuotes(instruments)
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
  }, [instruments])

  const doubled = useMemo(() => [...instruments, ...instruments], [instruments])
  const durationSec = Math.max(30, Math.round((instruments.length || 1) * 3.25))

  return (
    <div className="border-b border-cyan-500/20 bg-background/90 backdrop-blur-sm overflow-hidden" data-testid="market-ticker">
      <div className="relative group">
        {error || watchlistError ? (
          <div className="px-6 py-2 text-xs text-muted-foreground">{error || watchlistError}</div>
        ) : instruments.length === 0 ? (
          <div className="px-6 py-2 text-xs text-muted-foreground">No instruments</div>
        ) : (
          <div className="flex items-center justify-between">
            <div
              className="flex w-max animate-scroll group-hover:[animation-play-state:paused]"
              style={{ animationDuration: `${durationSec}s` }}
              aria-label="Market ticker"
            >
            {doubled.map((inst, idx) => {
              const q = quotes[inst.symbol]
              const changePct = q?.changePct ?? null
              const price = q?.price ?? null

              return (
                <div
                  key={idx < instruments.length ? inst.symbol : `${inst.symbol}:dup`}
                  className="flex items-center gap-3 px-6 py-2 whitespace-nowrap border-r border-cyan-500/10"
                >
                  <span className="font-bold bloomberg-font text-cyan-400 text-sm">{inst.symbol}</span>
                  <span className="text-xs text-muted-foreground">{price == null ? '—' : `$${price.toFixed(2)}`}</span>
                  <div className="flex items-center gap-1">
                    {changePct == null ? null : changePct >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-400" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-400" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        changePct == null
                          ? 'text-muted-foreground'
                          : changePct > 0
                            ? 'text-green-400'
                            : changePct < 0
                              ? 'text-red-400'
                              : 'text-muted-foreground'
                      }`}
                    >
                      {changePct == null ? '—' : `${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%`}
                    </span>
                  </div>
                </div>
              )
            })}
            </div>
            {lastUpdatedAt ? (
              <div className="hidden sm:block px-4 py-2 text-[11px] text-muted-foreground whitespace-nowrap">
                Updated {formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

