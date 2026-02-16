import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getPlanDetails } from '@/lib/billing/plan'
import { addInstrumentToWatchlist, getUserWatchlist, removeInstrumentFromWatchlist } from '@/lib/services/watchlist'

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', email: 'u@example.com' } }, error: null })),
    },
  })),
}))

vi.mock('@/lib/billing/plan', () => ({
  getPlanDetails: vi.fn(),
}))

vi.mock('@/lib/services/watchlist', () => ({
  getUserWatchlist: vi.fn(),
  addInstrumentToWatchlist: vi.fn(),
  removeInstrumentFromWatchlist: vi.fn(),
  updateWatchlistOrder: vi.fn(),
}))

const getPlanDetailsMock = vi.mocked(getPlanDetails)
const getUserWatchlistMock = vi.mocked(getUserWatchlist)
const addInstrumentToWatchlistMock = vi.mocked(addInstrumentToWatchlist)
const removeInstrumentFromWatchlistMock = vi.mocked(removeInstrumentFromWatchlist)

describe('/api/watchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns empty list for free users', async () => {
    getPlanDetailsMock.mockResolvedValue({ plan: 'free' })
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/watchlist', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.items).toEqual([])
  })

  it('POST is forbidden for non-pro users', async () => {
    getPlanDetailsMock.mockResolvedValue({ plan: 'free' })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ symbol: 'AAPL', kind: 'stock' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('POST adds to pro watchlist and returns updated items', async () => {
    getPlanDetailsMock.mockResolvedValue({ plan: 'pro' })
    addInstrumentToWatchlistMock.mockResolvedValue({ ok: true })
    getUserWatchlistMock.mockResolvedValue([
      { symbol: 'AAPL', name: 'Apple', kind: 'stock', defaultVisible: true, order: 1000 },
    ])

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ symbol: 'AAPL', kind: 'stock' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.items[0].symbol).toBe('AAPL')
  })

  it('DELETE removes from pro watchlist and returns updated items', async () => {
    getPlanDetailsMock.mockResolvedValue({ plan: 'pro' })
    removeInstrumentFromWatchlistMock.mockResolvedValue({ ok: true })
    getUserWatchlistMock.mockResolvedValue([])

    const { DELETE } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ symbol: 'AAPL', kind: 'stock' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
  })
})

