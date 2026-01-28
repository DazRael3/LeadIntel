import type { SupabaseClient } from '@supabase/supabase-js'
import type { InstrumentDefinition, InstrumentKind } from '@/lib/market/instruments'

export type UserWatchlistRow = {
  id: string
  user_id: string
  kind: InstrumentKind
  symbol: string
  display_name: string
  sort_order: number
}

const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-]{0,23}$/

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
    // For user watchlists, order is the saved sort order.
    order: r.sort_order,
  }))
}

export async function addInstrumentToWatchlist(
  client: SupabaseClient,
  userId: string,
  input: { symbol: string; kind: InstrumentKind; displayName?: string }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const symbol = input.symbol.trim().toUpperCase()
  if (!SYMBOL_RE.test(symbol)) return { ok: false, message: 'Invalid symbol' }

  const displayName = (input.displayName ?? symbol).trim()
  if (!displayName) return { ok: false, message: 'Invalid display name' }

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
    kind: input.kind,
    symbol,
    display_name: displayName,
    sort_order: sortOrder,
  })

  if (error) {
    console.error('[watchlist] Failed to add instrument', { userId, symbol, kind: input.kind, message: error.message })
    return { ok: false, message: 'Failed to add instrument' }
  }

  return { ok: true }
}

export async function removeInstrumentFromWatchlist(
  client: SupabaseClient,
  userId: string,
  input: { symbol: string; kind: InstrumentKind }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const symbol = input.symbol.trim().toUpperCase()
  if (!SYMBOL_RE.test(symbol)) return { ok: false, message: 'Invalid symbol' }

  const { error } = await client
    .from('user_watchlists')
    .delete()
    .eq('user_id', userId)
    .eq('kind', input.kind)
    .eq('symbol', symbol)

  if (error) {
    console.error('[watchlist] Failed to remove instrument', { userId, symbol, kind: input.kind, message: error.message })
    return { ok: false, message: 'Failed to remove instrument' }
  }

  return { ok: true }
}

export async function updateWatchlistOrder(
  client: SupabaseClient,
  userId: string,
  items: Array<{ symbol: string; kind: InstrumentKind; sortOrder: number }>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const rows = items
    .map((it) => {
      const symbol = it.symbol.trim().toUpperCase()
      if (!SYMBOL_RE.test(symbol)) return null
      if (!Number.isFinite(it.sortOrder) || it.sortOrder < 0) return null
      return { user_id: userId, kind: it.kind, symbol, sort_order: it.sortOrder }
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r))

  const { error } = await client.from('user_watchlists').upsert(rows)
  if (error) {
    console.error('[watchlist] Failed to update watchlist order', { userId, message: error.message })
    return { ok: false, message: 'Failed to update order' }
  }
  return { ok: true }
}

