import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/sources/cache', () => ({
  DEFAULT_TTL_HOURS: { gdelt: 6, first_party: 12, greenhouse: 24, lever: 24, sec: 24 },
  getFreshSnapshot: vi.fn(async () => ({ ok: true, snapshot: null })),
  upsertCompanyProfile: vi.fn(async () => ({ ok: true })),
  writeSnapshot: vi.fn(async () => ({ ok: true, id: 'snap_1' })),
}))

vi.mock('@/lib/sources/firstParty', () => ({
  fetchFirstPartySignals: vi.fn(async () => ({ ok: false, payload: {}, citations: [], meta: {} })),
}))

vi.mock('@/lib/sources/jobs', () => ({
  fetchHiringSignals: vi.fn(async () => ({ ok: false, sourceType: null, payload: {}, citations: [], meta: {} })),
}))

vi.mock('@/lib/sources/gdelt', () => ({
  fetchGdeltNews: vi.fn(async () => ({
    ok: true,
    payload: { query: 'x', articlesCount: 2, articles: [] },
    citations: [{ url: 'https://news.example/a', type: 'news', source: 'GDELT' }, { url: 'https://news.example/b', type: 'news', source: 'GDELT' }],
    meta: {},
  })),
}))

vi.mock('@/lib/sources/sec', () => ({
  fetchSecFilings: vi.fn(async () => ({ ok: false, payload: {}, citations: [], meta: {} })),
  fetchSecFilingsByTicker: vi.fn(async () => ({
    ok: true,
    payload: { matched: { cik: '123', ticker: 'GOOG', title: 'Google LLC', match: 'ticker' }, filings: [] },
    citations: [{ url: 'https://sec.example/1', type: 'filing', source: 'SEC' }, { url: 'https://sec.example/2', type: 'filing', source: 'SEC' }],
    meta: {},
  })),
}))

describe('refreshCompanySourcesForReport', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('name-only can return GDELT citations', async () => {
    const { refreshCompanySourcesForReport } = await import('./orchestrate')
    const res = await refreshCompanySourcesForReport({
      companyKey: 'name:google',
      companyName: 'Google',
      companyDomain: null,
      inputUrl: null,
      ticker: null,
      force: true,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.bundle.allCitations.length).toBeGreaterThanOrEqual(2)
  })

  it('ticker-only can return SEC citations and resolve company name', async () => {
    const { refreshCompanySourcesForReport } = await import('./orchestrate')
    const res = await refreshCompanySourcesForReport({
      companyKey: 'ticker:GOOG',
      companyName: null,
      companyDomain: null,
      inputUrl: null,
      ticker: 'GOOG',
      force: true,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.bundle.allCitations.length).toBeGreaterThanOrEqual(2)
    expect(res.resolvedCompanyName).toBeTruthy()
  })
})

