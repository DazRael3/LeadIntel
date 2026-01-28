export type MarketDataProvider = 'none' | 'finnhub' | 'polygon'

export type LiveQuote = {
  symbol: string
  price: number | null
  changePct: number | null
  updatedAt: string | null
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

async function pooledMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0
  const workers = new Array(Math.max(1, Math.min(limit, items.length))).fill(0).map(async () => {
    while (idx < items.length) {
      const myIdx = idx++
      results[myIdx] = await fn(items[myIdx])
    }
  })
  await Promise.all(workers)
  return results
}

async function fetchFinnhubQuote(symbol: string, apiKey: string): Promise<LiveQuote> {
  const url = new URL('https://finnhub.io/api/v1/quote')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('token', apiKey)

  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) return { symbol, price: null, changePct: null, updatedAt: null }
  const json = (await res.json()) as unknown
  if (typeof json !== 'object' || json === null) return { symbol, price: null, changePct: null, updatedAt: null }
  const q = json as { c?: unknown; dp?: unknown; t?: unknown }

  const price = typeof q.c === 'number' && Number.isFinite(q.c) ? q.c : null
  const changePct = typeof q.dp === 'number' && Number.isFinite(q.dp) ? clamp(q.dp, -99, 99) : null
  const updatedAt = typeof q.t === 'number' && Number.isFinite(q.t) ? new Date(q.t * 1000).toISOString() : null
  return { symbol, price, changePct, updatedAt }
}

async function fetchPolygonPrevClose(symbol: string, apiKey: string): Promise<LiveQuote> {
  const url = new URL(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev`)
  url.searchParams.set('adjusted', 'true')
  url.searchParams.set('apiKey', apiKey)

  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) return { symbol, price: null, changePct: null, updatedAt: null }
  const json = (await res.json()) as unknown
  if (typeof json !== 'object' || json === null) return { symbol, price: null, changePct: null, updatedAt: null }

  const payload = json as { results?: unknown }
  const results = Array.isArray(payload.results) ? payload.results : []
  const row = (results[0] ?? null) as { c?: unknown; o?: unknown; t?: unknown } | null
  const close = typeof row?.c === 'number' && Number.isFinite(row.c) ? row.c : null
  const open = typeof row?.o === 'number' && Number.isFinite(row.o) ? row.o : null
  const changePct = close != null && open != null && open !== 0 ? clamp(((close - open) / open) * 100, -99, 99) : null
  const updatedAt = typeof row?.t === 'number' && Number.isFinite(row.t) ? new Date(row.t).toISOString() : null
  return { symbol, price: close, changePct, updatedAt }
}

export async function fetchQuotesForSymbols(input: {
  provider: Exclude<MarketDataProvider, 'none'>
  apiKey: string
  symbols: string[]
}): Promise<LiveQuote[]> {
  const symbols = input.symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)
  if (symbols.length === 0) return []

  const limit = input.provider === 'finnhub' ? 6 : 4
  return await pooledMap(symbols, limit, async (symbol) => {
    try {
      if (input.provider === 'finnhub') return await fetchFinnhubQuote(symbol, input.apiKey)
      if (input.provider === 'polygon') return await fetchPolygonPrevClose(symbol, input.apiKey)
      return { symbol, price: null, changePct: null, updatedAt: null }
    } catch {
      return { symbol, price: null, changePct: null, updatedAt: null }
    }
  })
}

