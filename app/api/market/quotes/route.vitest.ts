import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Minimal auth client for withApiGuard.
vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
    },
  })),
}))

// Avoid Upstash rate limit dependency when NODE_ENV is forced to production in tests.
vi.mock('@/lib/api/ratelimit-policy', async () => {
  const actual = await vi.importActual<any>('@/lib/api/ratelimit-policy')
  return {
    ...actual,
    checkPolicyRateLimit: vi.fn(async () => ({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Math.floor(Date.now() / 1000) + 60,
    })),
  }
})

const fetchQuotesForSymbols = vi.fn()
vi.mock('@/lib/market/liveProvider', () => ({
  fetchQuotesForSymbols: (input: unknown) => fetchQuotesForSymbols(input),
}))

describe('/api/market/quotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()

    // Required env for env.ts validation (keep consistent with other route tests).
    process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000'
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123'
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123'
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-openai'

    // Enable live provider mapping (but we mock the provider call).
    process.env.MARKET_DATA_PROVIDER = 'finnhub'
    process.env.MARKET_DATA_API_KEY = 'md_test_key'
    process.env.FINNHUB_API_KEY = '' // avoid logo fetch in this test
  })

  it('calls provider with expected symbols and maps response into quotes', async () => {
    vi.resetModules()

    fetchQuotesForSymbols.mockResolvedValue([
      { symbol: 'AAPL', price: 189.12, changePct: 1.23, updatedAt: '2026-01-01T00:00:00.000Z' },
    ])

    const { POST } = await import('./route')

    const req = new NextRequest('http://localhost:3000/api/market/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        instruments: [
          { symbol: 'aapl', kind: 'stock' },
          { symbol: 'btc-usd', kind: 'crypto' },
        ],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    expect(fetchQuotesForSymbols).toHaveBeenCalledWith({
      provider: 'finnhub',
      apiKey: 'md_test_key',
      symbols: ['AAPL'],
      debug: false,
    })

    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data?.quotes)).toBe(true)

    const quotes = json.data.quotes as Array<{
      symbol: string
      kind: string
      price: number | null
      changePct: number | null
      lastPrice?: number | null
      changePercent?: number | null
    }>
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]))
    expect(bySymbol.get('AAPL')?.kind).toBe('stock')
    expect(bySymbol.get('AAPL')?.price).toBe(189.12)
    expect(bySymbol.get('AAPL')?.changePct).toBe(1.23)
    expect(bySymbol.get('AAPL')?.lastPrice).toBe(189.12)
    expect(bySymbol.get('AAPL')?.changePercent).toBe(1.23)
  })

  it('fills crypto via CoinGecko USD and keeps route 200 if provider lacks crypto coverage', async () => {
    vi.resetModules()

    // Provider returns only the stock.
    fetchQuotesForSymbols.mockResolvedValue([
      { symbol: 'AAPL', price: 100, changePct: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
    ])

    // CoinGecko returns BTC USD price + 24h percent change.
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bitcoin: { usd: 50000, usd_24h_change: -0.5 } }),
    } as unknown as Response)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/market/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        instruments: [
          { symbol: 'aapl', kind: 'stock' },
          { symbol: 'btc-usd', kind: 'crypto' },
        ],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    const quotes = json.data.quotes as Array<{ symbol: string; kind: string; lastPrice?: number | null; changePercent?: number | null }>
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]))
    expect(bySymbol.get('BTC-USD')?.kind).toBe('crypto')
    expect(bySymbol.get('BTC-USD')?.lastPrice).toBe(50000)
    expect(bySymbol.get('BTC-USD')?.changePercent).toBe(-0.5)
  })

  it('production mode returns only USD quotes', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MARKET_DATA_PROVIDER', 'finnhub')
    vi.stubEnv('MARKET_DATA_API_KEY', 'md_test_key')

    fetchQuotesForSymbols.mockResolvedValue([{ symbol: 'AAPL', price: 100, changePct: 1, updatedAt: '2026-01-01T00:00:00.000Z' }])
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bitcoin: { usd: 50000, usd_24h_change: -0.5 } }),
    } as unknown as Response)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/market/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        instruments: [
          { symbol: 'aapl', kind: 'stock' },
          { symbol: 'btc-usd', kind: 'crypto' },
        ],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    const quotes = json.data.quotes as Array<{ currency?: string }>
    expect(quotes.length).toBeGreaterThan(0)
    expect(quotes.every((q) => q.currency === 'USD')).toBe(true)
  })
})

