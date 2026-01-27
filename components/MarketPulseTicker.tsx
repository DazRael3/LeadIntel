'use client'

import { useEffect, useMemo, useState } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { useMarketWatchlist } from "@/app/dashboard/hooks/useMarketWatchlist"
import { getMockQuotes, type MarketQuote } from "@/lib/markets/mockQuotes"

export function MarketPulseTicker() {
  const { resolved, error } = useMarketWatchlist()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    // Refresh mock quotes periodically (list animation stays stable).
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const quotes: MarketQuote[] = useMemo(() => getMockQuotes(resolved, now), [resolved, now])
  const doubled = useMemo(() => [...quotes, ...quotes], [quotes])
  const durationSec = Math.max(30, Math.round((quotes.length || 1) * 3.5))

  return (
    <div
      className="border-b border-cyan-500/20 bg-background/90 backdrop-blur-sm overflow-hidden"
      data-testid="market-ticker"
    >
      <div className="relative group">
        {error ? (
          <div className="px-6 py-2 text-xs text-muted-foreground">
            Market data unavailable
          </div>
        ) : quotes.length === 0 ? (
          <div className="px-6 py-2 text-xs text-muted-foreground">No symbols</div>
        ) : (
          <div
            className="flex w-max animate-scroll group-hover:[animation-play-state:paused]"
            style={{ animationDuration: `${durationSec}s` }}
            aria-label="Market ticker"
          >
            {doubled.map((q, index) => (
              <div
                key={`${q.instrumentType}:${q.symbol}:${index}`}
                data-testid="ticker-item"
                className="flex items-center gap-3 px-6 py-2 whitespace-nowrap border-r border-cyan-500/10"
              >
                <span className="font-bold bloomberg-font text-cyan-400 text-sm">
                  {q.symbol}
                </span>
                <span className="text-xs text-muted-foreground">
                  ${q.price.toFixed(2)}
                </span>
                <div className="flex items-center gap-1">
                  {q.changePercent >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-400" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      q.changePercent > 0
                        ? 'text-green-400'
                        : q.changePercent < 0
                        ? 'text-red-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {q.changePercent > 0 ? '+' : ''}
                    {q.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
