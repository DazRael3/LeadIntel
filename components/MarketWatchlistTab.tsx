'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

export function MarketWatchlistTab() {
  const { isPro } = usePlan()
  const { yourWatchlist, starredKeys, remove, loading: watchlistLoading } = useMarketWatchlist()

  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const quoteUniverse = useMemo(() => yourWatchlist, [yourWatchlist])

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
    <Card className="border-cyan-500/20 bg-card/50" data-testid="market-watchlist-tab">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl bloomberg-font neon-cyan">WATCHLIST</CardTitle>
            <div className="text-xs text-muted-foreground mt-1">
              {lastUpdatedAt ? (
                <>Last price update {formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true })}</>
              ) : (
                <>Live pricing refreshes every ~45s</>
              )}
            </div>
          </div>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
            {yourWatchlist.length} starred
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {error ? <div className="text-xs text-muted-foreground">{error}</div> : null}

        {!isPro ? (
          <div className="text-sm text-muted-foreground">
            Upgrade to Pro to star symbols and build a personal watchlist.
            <Button size="sm" variant="ghost" className="ml-2 text-purple-300 hover:bg-purple-500/10" onClick={() => (window.location.href = '/pricing')}>
              Upgrade
            </Button>
          </div>
        ) : null}

        {watchlistLoading ? (
          <div className="text-center py-10 text-muted-foreground animate-pulse">Loading watchlist…</div>
        ) : yourWatchlist.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Star className="h-10 w-10 mx-auto text-muted-foreground" />
            <div className="text-muted-foreground">No starred symbols yet</div>
            <div className="text-xs text-muted-foreground">
              Use the Markets sidebar to add symbols, then star them to pin here.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {yourWatchlist.map((inst) => {
              const q = quotes[inst.symbol]
              const change = q?.changePct ?? null
              const price = q?.price ?? null
              const key = `${inst.kind}:${inst.symbol}`
              const starred = starredKeys.has(key)
              return (
                <div
                  key={`watchlist:${key}`}
                  className="flex items-center justify-between rounded border border-cyan-500/10 bg-background/30 px-3 py-2"
                  data-testid={`market-watchlist-tab-row-${inst.symbol}`}
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

                  <div className="flex items-center gap-2">
                    {change == null ? null : change >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )}
                    <button
                      type="button"
                      aria-label={starred ? 'Unstar' : 'Star'}
                      className={`p-1 rounded hover:bg-cyan-500/10 ${!isPro ? 'opacity-40 cursor-not-allowed' : ''}`}
                      onClick={() => void remove(inst.symbol, inst.kind)}
                      disabled={!isPro}
                    >
                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

