import type { SupabaseClient } from '@supabase/supabase-js'
import type { InstrumentDefinition, InstrumentKind } from '@/lib/market/instruments'
import { findDefaultInstrument } from '@/lib/market/instruments'

export type UserWatchlistRow = {
  id: string
  user_id: string
  kind: InstrumentKind
  symbol: string
  display_name: string
  sort_order: number
}

export async function getUserWatchlist(client: SupabaseClient, userId: string): Promise<InstrumentDefinition[]> {
  const { data, error } = await client
    .from('user_watchlists')
    .select('symbol, kind, display_name, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[watchlist] Failed to load user watchlist', { userId, message: error.message })
    return []
  }

  type Row = { symbol: string; kind: InstrumentKind; display_name: string; sort_order: number }
  const rows = (data ?? []) as Row[]
  return rows.map((r) => ({
    symbol: r.symbol,
    name: r.display_name,
    kind: r.kind,
    defaultVisible: true,
    // Put user entries after defaults by default ordering; UI can override with sort_order.
    order: 1000 + r.sort_order,
  }))
}

export async function addInstrumentToWatchlist(
  client: SupabaseClient,
  userId: string,
  input: { symbol: string; kind: InstrumentKind }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const def = findDefaultInstrument(input.symbol, input.kind)
  if (!def) return { ok: false, message: 'Unknown instrument' }

  // Determine next sort_order
  const { data: existing } = await client
    .from('user_watchlists')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const maxSort = (existing as { sort_order?: number } | null)?.sort_order ?? -1
  const sortOrder = maxSort + 1

  const { error } = await client.from('user_watchlists').upsert({
    user_id: userId,
    kind: def.kind,
    symbol: def.symbol,
    display_name: def.name,
    sort_order: sortOrder,
  })

  if (error) {
    console.error('[watchlist] Failed to add instrument', { userId, symbol: def.symbol, kind: def.kind, message: error.message })
    return { ok: false, message: 'Failed to add instrument' }
  }

  return { ok: true }
}

export async function removeInstrumentFromWatchlist(
  client: SupabaseClient,
  userId: string,
  input: { symbol: string; kind: InstrumentKind }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const def = findDefaultInstrument(input.symbol, input.kind)
  if (!def) return { ok: false, message: 'Unknown instrument' }

  const { error } = await client
    .from('user_watchlists')
    .delete()
    .eq('user_id', userId)
    .eq('kind', def.kind)
    .eq('symbol', def.symbol)

  if (error) {
    console.error('[watchlist] Failed to remove instrument', { userId, symbol: def.symbol, kind: def.kind, message: error.message })
    return { ok: false, message: 'Failed to remove instrument' }
  }

  return { ok: true }
}

export async function updateWatchlistOrder(
  client: SupabaseClient,
  userId: string,
  items: Array<{ symbol: string; kind: InstrumentKind; sortOrder: number }>
): Promise<{ ok: true } | { ok: false; message: string }> {
  // Only allow ordering for known defaults (keeps symbol universe bounded).
  const rows = items
    .map((it) => {
      const def = findDefaultInstrument(it.symbol, it.kind)
      if (!def) return null
      return { user_id: userId, kind: def.kind, symbol: def.symbol, display_name: def.name, sort_order: it.sortOrder }
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r))

  const { error } = await client.from('user_watchlists').upsert(rows)
  if (error) {
    console.error('[watchlist] Failed to update watchlist order', { userId, message: error.message })
    return { ok: false, message: 'Failed to update order' }
  }
  return { ok: true }
}

