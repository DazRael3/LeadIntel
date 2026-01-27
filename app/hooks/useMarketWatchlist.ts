'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { InstrumentDefinition, InstrumentKind } from '@/lib/market/instruments'
import { DEFAULT_INSTRUMENTS } from '@/lib/market/instruments'

type WatchlistApiResponse =
  | { ok: true; data: { items: InstrumentDefinition[] } }
  | { ok: false; error?: { message?: string } }

function isOk(resp: WatchlistApiResponse): resp is { ok: true; data: { items: InstrumentDefinition[] } } {
  return resp.ok === true
}

export function mergeVisibleInstruments(defaults: InstrumentDefinition[], user: InstrumentDefinition[]): InstrumentDefinition[] {
  const map = new Map<string, InstrumentDefinition>()
  for (const d of defaults) {
    map.set(`${d.kind}:${d.symbol}`, d)
  }
  for (const u of user) {
    map.set(`${u.kind}:${u.symbol}`, u)
  }
  return Array.from(map.values()).sort((a, b) => a.order - b.order)
}

export function useMarketWatchlist() {
  const defaults = useMemo(
    () => DEFAULT_INSTRUMENTS.filter((i) => i.defaultVisible).slice().sort((a, b) => a.order - b.order),
    []
  )
  const [userItems, setUserItems] = useState<InstrumentDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/watchlist', { method: 'GET' })
      if (!res.ok) {
        // Not authenticated (401) or not available: treat as no custom watchlist.
        setUserItems([])
        return
      }
      const json = (await res.json()) as WatchlistApiResponse
      if (!json || !isOk(json)) {
        setUserItems([])
        return
      }
      setUserItems(json.data.items ?? [])
    } catch {
      setUserItems([])
      setError('Market watchlist unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visible = useMemo(() => mergeVisibleInstruments(defaults, userItems), [defaults, userItems])
  const starredKeys = useMemo(() => new Set(userItems.map((i) => `${i.kind}:${i.symbol}`)), [userItems])

  const add = useCallback(async (symbol: string, kind: InstrumentKind) => {
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, kind }),
    })
    if (!res.ok) throw new Error(`Failed to add (${res.status})`)
    const json = (await res.json()) as WatchlistApiResponse
    if (isOk(json)) setUserItems(json.data.items ?? [])
  }, [])

  const remove = useCallback(async (symbol: string, kind: InstrumentKind) => {
    const res = await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, kind }),
    })
    if (!res.ok) throw new Error(`Failed to remove (${res.status})`)
    const json = (await res.json()) as WatchlistApiResponse
    if (isOk(json)) setUserItems(json.data.items ?? [])
  }, [])

  return { defaults, userItems, visible, starredKeys, loading, error, refresh, add, remove }
}

