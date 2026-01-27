'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TrendingUp, TrendingDown, Activity, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import { useMarketWatchlist, type WatchlistItemInput } from "@/app/dashboard/hooks/useMarketWatchlist"
import { getMockQuotes, type MarketQuote } from "@/lib/markets/mockQuotes"

function generateSalesInsight(changePercent: number): string {
  if (changePercent > 1.5) return 'Market surge: High-growth leads are actively seeking solutions'
  if (changePercent > 0.5) return 'Market is up: High-growth leads are active today'
  if (changePercent < -0.5) return 'Market correction: Focus on value-driven outreach'
  return 'Market stable: Steady B2B opportunities available'
}

export function MarketPulse() {
  const { isPro, resolved, save, loading, error } = useMarketWatchlist()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<WatchlistItemInput[]>([])
  const [newSymbol, setNewSymbol] = useState('')
  const [newType, setNewType] = useState<'stock' | 'crypto'>('stock')
  const [saveError, setSaveError] = useState<string | null>(null)

  const quotes: MarketQuote[] = useMemo(() => getMockQuotes(resolved), [resolved])

  const averageChange = useMemo(() => {
    if (quotes.length === 0) return 0
    return quotes.reduce((sum, q) => sum + q.changePercent, 0) / quotes.length
  }, [quotes])

  const status = averageChange > 0.5 ? 'up' : averageChange < -0.5 ? 'down' : 'neutral'

  function openEditor() {
    setDraft(resolved.map((i) => ({ symbol: i.symbol, instrumentType: i.type })))
    setSaveError(null)
    setIsEditing(true)
  }

  function closeEditor() {
    setIsEditing(false)
    setSaveError(null)
    setNewSymbol('')
    setNewType('stock')
  }

  function addDraftItem() {
    const sym = newSymbol.trim().toUpperCase()
    if (!/^[A-Z0-9.]{1,15}$/.test(sym)) {
      setSaveError('Invalid symbol (use letters/numbers/dot, e.g. AAPL or BRK.B)')
      return
    }
    if (draft.some((d) => d.symbol === sym && d.instrumentType === newType)) {
      setSaveError('Symbol already in watchlist')
      return
    }
    setDraft((prev) => [...prev, { symbol: sym, instrumentType: newType }])
    setNewSymbol('')
    setSaveError(null)
  }

  async function handleSave() {
    setSaveError(null)
    const result = await save(draft)
    if (!result.ok) {
      setSaveError(result.message)
      return
    }
    closeEditor()
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400" />
            <CardTitle className="text-lg bloomberg-font">MARKET PULSE</CardTitle>
          </div>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
            {status === 'up' ? 'UP' : status === 'down' ? 'DOWN' : 'STABLE'}
          </Badge>
        </div>
        <CardDescription className="text-xs uppercase tracking-wider">
          Your Market Watchlist • 24h Change (mock)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-muted-foreground" data-testid="market-watchlist-count">
            {error ? 'Market data unavailable' : `${resolved.length} symbols`}
          </div>
          {isPro ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={openEditor}
              className="text-cyan-400 hover:bg-cyan-500/10"
              data-testid="market-watchlist-edit"
            >
              Edit Watchlist
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (window.location.href = '/pricing')}
              className="text-purple-400 hover:bg-purple-500/10"
              data-testid="market-watchlist-upsell"
            >
              Customize (Pro)
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted/20 animate-pulse rounded" />
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-muted-foreground py-6">
            Market data unavailable.
          </div>
        ) : (
          <div className="space-y-3">
            {quotes.slice(0, 10).map((q) => (
              <div
                key={`${q.instrumentType}:${q.symbol}`}
                className="flex items-center justify-between p-3 rounded-lg border border-cyan-500/10 bg-background/30 hover:bg-background/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold bloomberg-font text-cyan-400">{q.symbol}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      {q.instrumentType}
                    </span>
                    {q.changePercent >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">
                      ${q.price.toFixed(2)}
                    </span>
                    <span
                      className={
                        q.changePercent > 0
                          ? 'text-green-400'
                          : q.changePercent < 0
                          ? 'text-red-400'
                          : 'text-muted-foreground'
                      }
                    >
                      {q.change > 0 ? '+' : ''}
                      {q.change.toFixed(2)} ({q.changePercent > 0 ? '+' : ''}
                      {q.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="flex items-start gap-2 mt-2 pt-2 border-t border-cyan-500/10">
                    <Sparkles className="h-3 w-3 text-purple-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground italic">
                      {generateSalesInsight(q.changePercent)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Simple Pro-only editor modal */}
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div
              className="w-full max-w-lg rounded-lg border border-cyan-500/20 bg-background p-4"
              data-testid="market-watchlist-modal"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-lg font-bold">Edit Market Watchlist</div>
                  <div className="text-xs text-muted-foreground">Controls ticker + market panel</div>
                </div>
                <Button variant="ghost" onClick={closeEditor}>
                  Close
                </Button>
              </div>

              {saveError && (
                <div className="mb-3 text-sm text-red-400">{saveError}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Symbol</Label>
                  <Input
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    placeholder="AAPL / BTC / BRK.B"
                    data-testid="market-watchlist-symbol"
                  />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as 'stock' | 'crypto')}
                    data-testid="market-watchlist-type"
                  >
                    <option value="stock">Stock</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <Button
                  onClick={addDraftItem}
                  className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30"
                  data-testid="market-watchlist-add"
                >
                  Add
                </Button>
                <Button variant="ghost" onClick={() => setDraft([])} data-testid="market-watchlist-clear">
                  Clear
                </Button>
              </div>

              <div className="max-h-64 overflow-auto space-y-2 mb-4">
                {draft.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No symbols yet.</div>
                ) : (
                  draft.map((it, idx) => (
                    <div key={`${it.instrumentType}:${it.symbol}:${idx}`} className="flex items-center justify-between rounded border border-cyan-500/10 bg-card/40 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-cyan-300">{it.symbol}</span>
                        <span className="text-xs text-muted-foreground uppercase">{it.instrumentType}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => idx > 0 && setDraft((prev) => {
                            const next = prev.slice()
                            const tmp = next[idx - 1]
                            next[idx - 1] = next[idx]
                            next[idx] = tmp
                            return next
                          })}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => idx < draft.length - 1 && setDraft((prev) => {
                            const next = prev.slice()
                            const tmp = next[idx + 1]
                            next[idx + 1] = next[idx]
                            next[idx] = tmp
                            return next
                          })}
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDraft((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:bg-red-500/10"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={closeEditor}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30"
                  data-testid="market-watchlist-save"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
