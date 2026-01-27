'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_WATCHLIST, type DefaultInstrument, type InstrumentType } from '@/lib/markets/defaultWatchlist'
import { usePlan } from '@/components/PlanProvider'
import { formatErrorMessage } from '@/lib/utils/format-error'

export type WatchlistItemInput = {
  symbol: string
  instrumentType: InstrumentType
}

type WatchlistApiItem = WatchlistItemInput & { position?: number }

type WatchlistApiResponse =
  | { ok: true; data: { items: WatchlistApiItem[] } }
  | { ok: false; error?: { message?: string } }

export function useMarketWatchlist() {
  const { isPro } = usePlan()
  const [customItems, setCustomItems] = useState<WatchlistApiItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/watchlist', { method: 'GET' })
      if (!res.ok) {
        // 404/401/etc: treat as "no custom watchlist" (fallback to defaults)
        setCustomItems([])
        return
      }
      const json = (await res.json()) as WatchlistApiResponse
      if (!json || (json as any).ok !== true) {
        setCustomItems([])
        return
      }
      const items = json.data.items ?? []
      setCustomItems(items)
    } catch (e) {
      setError(formatErrorMessage(e))
      setCustomItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(
    async (items: WatchlistItemInput[]): Promise<{ ok: true } | { ok: false; message: string }> => {
      try {
        const res = await fetch('/api/watchlist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        })
        if (!res.ok) {
          const raw = await res.text()
          return { ok: false, message: raw || `Failed to save watchlist (${res.status})` }
        }
        await load()
        return { ok: true }
      } catch (e) {
        return { ok: false, message: formatErrorMessage(e) }
      }
    },
    [load]
  )

  useEffect(() => {
    void load()
  }, [load])

  const resolved: DefaultInstrument[] = useMemo(() => {
    // Free users always see curated defaults (customization is Pro-only).
    if (!isPro) return DEFAULT_WATCHLIST
    if (!customItems || customItems.length === 0) return DEFAULT_WATCHLIST
    return customItems.map((it) => ({ symbol: it.symbol, type: it.instrumentType }))
  }, [isPro, customItems])

  return {
    isPro,
    loading,
    error,
    customItems: customItems ?? [],
    resolved,
    refresh: load,
    save,
  }
}

