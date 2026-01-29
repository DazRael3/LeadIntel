'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star, TrendingDown, TrendingUp } from 'lucide-react'
import { usePlan } from '@/components/PlanProvider'
import { useMarketWatchlist } from '@/app/hooks/useMarketWatchlist'
import { fetchInstrumentQuotes, type InstrumentQuote } from '@/lib/market/prices'
import { formatDistanceToNow } from 'date-fns'

type QuoteMap = Record<string, InstrumentQuote>

function toQuoteMap(quotes: InstrumentQuote[]): QuoteMap {
  const map: QuoteMap = {}
  for (const q of quotes) map[q.symbol] = q
  return map
}

export function MarketPulse() {
  const { isPro } = usePlan()
  const { allInstruments, yourWatchlist, starredKeys } = useMarketWatchlist()

  const quoteUniverse = useMemo(() => {
    // For Market Pulse, always show the full universe (defaults + your custom).
    const map = new Map<string, typeof allInstruments[number]>()
    for (const i of allInstruments) map.set(`${i.kind}:${i.symbol}`, i)
    for (const i of yourWatchlist) map.set(`${i.kind}:${i.symbol}`, i)
    return Array.from(map.values())
  }, [allInstruments, yourWatchlist])

  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const next = await fetchInstrumentQuotes(quoteUniverse)
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
    const t = setInterval(refresh, 45000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [quoteUniverse])

  return (
    <Card className="border-cyan-500/20 bg-card/50" data-testid="market-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl bloomberg-font neon-cyan">MARKET PULSE</CardTitle>
            <div className="text-xs text-muted-foreground mt-1">
              {lastUpdatedAt ? (
                <>Last price update {formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true })}</>
              ) : (
                <>Live pricing refreshes every ~45s</>
              )}
            </div>
          </div>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
            {yourWatchlist.length > 0 ? `${yourWatchlist.length} starred` : 'Defaults'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? <div className="text-xs text-muted-foreground">{error}</div> : null}

        {yourWatchlist.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground flex items-center gap-2">
              <Star className="h-3 w-3 text-yellow-400" />
              YOUR WATCHLIST (STARRED)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {yourWatchlist.map((inst) => {
                const q = quotes[inst.symbol]
                const change = q?.changePct ?? null
                const price = q?.price ?? null
                return (
                  <div
                    key={`starred:${inst.kind}:${inst.symbol}`}
                    className="flex items-center justify-between rounded border border-cyan-500/10 bg-background/30 px-3 py-2"
                    data-testid={`market-pulse-starred-${inst.symbol}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-cyan-300">{inst.symbol}</span>
                        <span className="truncate text-xs text-muted-foreground">{inst.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {price == null ? '—' : `$${price.toFixed(2)}`} •{' '}
                        <span
                          className={
                            change == null
                              ? 'text-muted-foreground'
                              : change > 0
                                ? 'text-green-400'
                                : change < 0
                                  ? 'text-red-400'
                                  : 'text-muted-foreground'
                          }
                        >
                          {change == null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`}
                        </span>
                      </div>
                    </div>
                    {change == null ? null : change >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-wide text-muted-foreground">ALL INSTRUMENTS</div>
          {!isPro ? (
            <div className="text-xs text-muted-foreground">
              Star symbols in the Markets sidebar to pin them to your personal watchlist (Pro).
            </div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {allInstruments.map((inst) => {
              const q = quotes[inst.symbol]
              const change = q?.changePct ?? null
              const price = q?.price ?? null
              const key = `${inst.kind}:${inst.symbol}`
              const starred = starredKeys.has(key)
              return (
                <div
                  key={`all:${key}`}
                  className="flex items-center justify-between rounded border border-cyan-500/10 bg-background/30 px-3 py-2"
                  data-testid={`market-pulse-all-${inst.symbol}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cyan-300">{inst.symbol}</span>
                      <span className="truncate text-xs text-muted-foreground">{inst.name}</span>
                      {starred ? (
                        <Badge variant="outline" className="border-yellow-500/30 text-yellow-300 bg-yellow-500/10 text-[10px]">
                          Starred
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {price == null ? '—' : `$${price.toFixed(2)}`} •{' '}
                      <span
                        className={
                          change == null
                            ? 'text-muted-foreground'
                            : change > 0
                              ? 'text-green-400'
                              : change < 0
                                ? 'text-red-400'
                                : 'text-muted-foreground'
                        }
                      >
                        {change == null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`}
                      </span>
                    </div>
                  </div>
                  {change == null ? null : change >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

