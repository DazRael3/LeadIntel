'use client'

import { useEffect, useMemo, useState } from 'react'
import { Star, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePlan } from '@/components/PlanProvider'
import { DEFAULT_INSTRUMENTS, findDefaultInstrument, type InstrumentDefinition } from '@/lib/market/instruments'
import { fetchInstrumentQuotes, type InstrumentQuote } from '@/lib/market/prices'
import { useMarketWatchlist } from '@/app/hooks/useMarketWatchlist'
import { formatDistanceToNow } from 'date-fns'

type QuoteMap = Record<string, InstrumentQuote>

function toQuoteMap(quotes: InstrumentQuote[]): QuoteMap {
  const map: QuoteMap = {}
  for (const q of quotes) map[q.symbol] = q
  return map
}

export function MarketSidebar() {
  const { isPro } = usePlan()
  const { allInstruments, yourWatchlist, starredKeys, add, remove, loading: watchlistLoading } = useMarketWatchlist()

  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'stock' | 'crypto'>('stock')
  const [actionError, setActionError] = useState<string | null>(null)

  const quoteUniverse = useMemo(() => {
    const map = new Map<string, InstrumentDefinition>()
    for (const i of allInstruments) map.set(`${i.kind}:${i.symbol}`, i)
    for (const i of yourWatchlist) map.set(`${i.kind}:${i.symbol}`, i)
    return Array.from(map.values())
  }, [allInstruments, yourWatchlist])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const next = await fetchInstrumentQuotes(quoteUniverse)
        if (cancelled) return
        setQuotes(toQuoteMap(next))
        setLastUpdatedAt(next.map((q) => q.updatedAt).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null)
        setQuoteError(null)
      } catch {
        if (cancelled) return
        setQuoteError('Market data unavailable')
      }
    }
    void refresh()
    const interval = setInterval(refresh, 45000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [quoteUniverse])

  const suggestions = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return []
    return DEFAULT_INSTRUMENTS.filter((i) => i.symbol.includes(q)).slice(0, 8)
  }, [query])

  async function toggleStar(inst: InstrumentDefinition) {
    if (!isPro) return
    setActionError(null)
    const key = `${inst.kind}:${inst.symbol}`
    try {
      if (starredKeys.has(key)) {
        await remove(inst.symbol, inst.kind)
      } else {
        await add(inst.symbol, inst.kind)
      }
    } catch {
      setActionError('Failed to update watchlist')
    }
  }

  async function addFromQuery() {
    if (!isPro) return
    setActionError(null)
    const symbol = query.trim().toUpperCase()
    try {
      const match = DEFAULT_INSTRUMENTS.find((i) => i.symbol === symbol)
      await add(symbol, (match?.kind ?? kind) as InstrumentDefinition['kind'], match?.name)
      setQuery('')
    } catch {
      setActionError('Failed to update watchlist')
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50" data-testid="market-sidebar">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg bloomberg-font">MARKETS</CardTitle>
          </div>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
            {yourWatchlist.length}
          </Badge>
        </div>
        {lastUpdatedAt ? (
          <div className="text-[11px] text-muted-foreground">
            Last price update {formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true })}
          </div>
        ) : null}
        {!isPro ? (
          <div className="text-xs text-muted-foreground">
            Upgrade to customize your watchlist.
            <Button
              size="sm"
              variant="ghost"
              className="ml-2 text-purple-300 hover:bg-purple-500/10"
              onClick={() => (window.location.href = '/pricing')}
            >
              Upgrade
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Star symbols to pin them to your personal watchlist.</div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {isPro && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Add symbol (e.g. AAPL, BTC-USD)"
                className="h-9"
                data-testid="market-sidebar-search"
              />
              <div className="flex rounded-md border border-cyan-500/20 overflow-hidden">
                <Button
                  type="button"
                  variant={kind === 'stock' ? 'default' : 'ghost'}
                  className="h-9 rounded-none px-3"
                  onClick={() => setKind('stock')}
                  aria-pressed={kind === 'stock'}
                  data-testid="market-kind-stock"
                >
                  Stock
                </Button>
                <Button
                  type="button"
                  variant={kind === 'crypto' ? 'default' : 'ghost'}
                  className="h-9 rounded-none px-3"
                  onClick={() => setKind('crypto')}
                  aria-pressed={kind === 'crypto'}
                  data-testid="market-kind-crypto"
                >
                  Crypto
                </Button>
              </div>
              <Button onClick={addFromQuery} disabled={!query.trim()} className="h-9" data-testid="market-sidebar-add">
                Add
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button
                    key={`${s.kind}:${s.symbol}`}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-cyan-500/20"
                    onClick={() => {
                      setQuery(s.symbol)
                      setKind(s.kind)
                    }}
                  >
                    {s.symbol}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {actionError && <div className="text-xs text-red-400">{actionError}</div>}
        {quoteError && <div className="text-xs text-muted-foreground">{quoteError}</div>}

        <div className="space-y-4 max-h-[520px] overflow-auto pr-1">
          {yourWatchlist.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold tracking-wide text-muted-foreground">YOUR WATCHLIST (STARRED)</div>
                <div className="text-xs text-muted-foreground">{yourWatchlist.length}</div>
              </div>
              {yourWatchlist.map((inst) => {
                const q = quotes[inst.symbol]
                const change = q?.changePct ?? null
                const price = q?.price ?? null
                const key = `${inst.kind}:${inst.symbol}`
                const starred = starredKeys.has(key)
                const name = inst.name

                return (
                  <div
                    key={`watchlist:${key}`}
                    className="flex items-center justify-between rounded border border-cyan-500/10 bg-background/30 px-3 py-2"
                    data-testid={`market-watchlist-row-${inst.symbol}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-cyan-300">{inst.symbol}</span>
                        <span className="truncate text-xs text-muted-foreground">{name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{price == null ? '—' : `$${price.toFixed(2)}`}</span>
                        <span className="opacity-60">•</span>
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
                        onClick={() => void toggleStar(inst)}
                        disabled={!isPro}
                        data-testid={`market-star-watchlist-${inst.symbol}`}
                      >
                        <Star className={`h-4 w-4 ${starred ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground">
              {yourWatchlist.length > 0 ? 'ALL INSTRUMENTS' : 'ALL INSTRUMENTS (STAR TO PIN)'}
            </div>
            {allInstruments.map((inst) => {
              const q = quotes[inst.symbol]
              const change = q?.changePct ?? null
              const price = q?.price ?? null
              const key = `${inst.kind}:${inst.symbol}`
              const starred = starredKeys.has(key)
              const def = findDefaultInstrument(inst.symbol, inst.kind)
              const name = def?.name ?? inst.name

              return (
                <div
                  key={`all:${key}`}
                  className="flex items-center justify-between rounded border border-cyan-500/10 bg-background/20 px-3 py-2"
                  data-testid={`market-row-${inst.symbol}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cyan-300">{inst.symbol}</span>
                      <span className="truncate text-xs text-muted-foreground">{name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{price == null ? '—' : `$${price.toFixed(2)}`}</span>
                      <span className="opacity-60">•</span>
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
                      onClick={() => void toggleStar(inst)}
                      disabled={!isPro}
                      data-testid={`market-star-all-${inst.symbol}`}
                    >
                      <Star className={`h-4 w-4 ${starred ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

