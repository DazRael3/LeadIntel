import { fetchJson } from '@/lib/sources/http'
import type { NormalizedCitation } from '@/lib/sources/normalize'
import { normalizeCitations } from '@/lib/sources/normalize'
import { getFreshSnapshot, upsertCompanyProfile, writeSnapshot, defaultSnapshotTimes } from '@/lib/sources/cache'

type SecTickerRow = { cik_str?: number; ticker?: string; title?: string }
type SecTickersIndex = Record<string, SecTickerRow>

type SecSubmissions = {
  cik?: string
  name?: string
  filings?: {
    recent?: {
      form?: string[]
      filingDate?: string[]
      accessionNumber?: string[]
      primaryDocument?: string[]
    }
  }
}

// SEC asks for max 10 requests/second, but we keep it conservative at 2 rps.
let secLastRequestAt = 0
let secQueue: Promise<void> = Promise.resolve()

async function secRateLimit(): Promise<void> {
  secQueue = secQueue.then(async () => {
    const minGapMs = 500
    const now = Date.now()
    const wait = Math.max(0, secLastRequestAt + minGapMs - now)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    secLastRequestAt = Date.now()
  })
  return secQueue
}

function normalizeCompanyNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|inc\.|corp|corp\.|corporation|ltd|ltd\.|llc|plc|co|co\.)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function pickTicker(index: SecTickersIndex, companyName: string): { cik: string; ticker: string; title: string; match: 'exact' | 'prefix' } | null {
  const target = normalizeCompanyNameForMatch(companyName)
  if (!target) return null
  const rows = Object.values(index)
    .map((r) => {
      const title = typeof r.title === 'string' ? r.title : ''
      const ticker = typeof r.ticker === 'string' ? r.ticker : ''
      const cik = typeof r.cik_str === 'number' ? String(r.cik_str) : ''
      if (!title || !ticker || !cik) return null
      const norm = normalizeCompanyNameForMatch(title)
      return { cik, ticker, title, norm }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))

  for (const r of rows) {
    if (r.norm === target) return { cik: r.cik, ticker: r.ticker, title: r.title, match: 'exact' }
  }
  for (const r of rows) {
    if (r.norm.startsWith(target) && target.length >= 4) return { cik: r.cik, ticker: r.ticker, title: r.title, match: 'prefix' }
  }
  return null
}

function pickByTicker(index: SecTickersIndex, ticker: string): { cik: string; ticker: string; title: string; match: 'ticker' } | null {
  const t = ticker.trim().toUpperCase()
  if (!t) return null
  const rows = Object.values(index)
    .map((r) => {
      const title = typeof r.title === 'string' ? r.title : ''
      const rowTicker = typeof r.ticker === 'string' ? r.ticker : ''
      const cik = typeof r.cik_str === 'number' ? String(r.cik_str) : ''
      if (!title || !rowTicker || !cik) return null
      return { cik, ticker: rowTicker.toUpperCase(), title }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))

  const found = rows.find((r) => r.ticker === t) ?? null
  return found ? { ...found, match: 'ticker' } : null
}

function cik10(cik: string): string {
  const digits = cik.replace(/[^0-9]/g, '')
  return digits.padStart(10, '0')
}

function secFilingUrl(args: { cik: string; accessionNumber: string; primaryDocument: string }): string {
  const cikInt = String(Number.parseInt(args.cik.replace(/[^0-9]/g, ''), 10))
  const accNoDashes = args.accessionNumber.replace(/-/g, '')
  return `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNoDashes}/${args.primaryDocument}`
}

async function getTickersIndex(): Promise<
  | { ok: true; index: SecTickersIndex; meta: Record<string, unknown> }
  | { ok: false; index: null; meta: Record<string, unknown> }
> {
  // Store as a snapshot in DB to avoid downloading frequently.
  const companyKey = '_sec_tickers_index'
  await upsertCompanyProfile({ companyKey, companyName: 'SEC tickers index', companyDomain: null, inputUrl: null })
  const cached = await getFreshSnapshot({ companyKey, sourceType: 'sec' })
  if (cached.ok && cached.snapshot && typeof cached.snapshot.payload === 'object' && cached.snapshot.payload) {
    return { ok: true, index: cached.snapshot.payload as SecTickersIndex, meta: { cached: true, fetchedAt: cached.snapshot.fetched_at } }
  }

  await secRateLimit()
  const url = 'https://www.sec.gov/files/company_tickers.json'
  const res = await fetchJson<SecTickersIndex>({
    url,
    timeoutMs: 9000,
    headers: { accept: 'application/json' },
  })
  if (!res.ok) {
    const { fetchedAt, expiresAt } = defaultSnapshotTimes('sec')
    await writeSnapshot({
      companyKey,
      sourceType: 'sec',
      fetchedAt,
      expiresAt,
      status: 'error',
      payload: {},
      citations: [],
      meta: { kind: 'tickers_index', errorCode: res.errorCode, status: res.status, url: res.url },
    })
    return { ok: false, index: null, meta: { errorCode: res.errorCode, status: res.status } }
  }

  const { fetchedAt, expiresAt } = defaultSnapshotTimes('sec')
  await writeSnapshot({
    companyKey,
    sourceType: 'sec',
    fetchedAt,
    expiresAt,
    status: 'ok',
    payload: res.json,
    citations: [{ url: res.url, source: 'SEC', type: 'tickers_index' }],
    meta: { kind: 'tickers_index', status: res.status },
  })
  return { ok: true, index: res.json, meta: { cached: false, status: res.status } }
}

export async function fetchSecFilings(args: {
  companyName: string
}): Promise<
  | {
      ok: true
      payload: { matched: { cik: string; ticker: string; title: string; match: string }; filings: Array<{ form: string; filingDate: string; url: string }> }
      citations: NormalizedCitation[]
      meta: Record<string, unknown>
    }
  | { ok: false; payload: {}; citations: []; meta: Record<string, unknown> }
> {
  const tickers = await getTickersIndex()
  if (!tickers.ok || !tickers.index) {
    return { ok: false, payload: {}, citations: [], meta: { errorCode: 'sec_tickers_unavailable', ...tickers.meta } }
  }

  const matched = pickTicker(tickers.index, args.companyName)
  if (!matched) {
    return { ok: false, payload: {}, citations: [], meta: { errorCode: 'sec_no_ticker_match' } }
  }

  await secRateLimit()
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${cik10(matched.cik)}.json`
  const res = await fetchJson<SecSubmissions>({
    url: submissionsUrl,
    timeoutMs: 9000,
    headers: { accept: 'application/json' },
  })
  if (!res.ok) {
    return { ok: false, payload: {}, citations: [], meta: { errorCode: res.errorCode, status: res.status, url: res.url } }
  }

  const recent = res.json.filings?.recent
  const forms = recent?.form ?? []
  const dates = recent?.filingDate ?? []
  const accessions = recent?.accessionNumber ?? []
  const docs = recent?.primaryDocument ?? []

  const filings: Array<{ form: string; filingDate: string; url: string }> = []
  for (let i = 0; i < Math.min(forms.length, dates.length, accessions.length, docs.length, 10); i++) {
    const form = (forms[i] ?? '').toString().trim()
    const filingDate = (dates[i] ?? '').toString().trim()
    const accessionNumber = (accessions[i] ?? '').toString().trim()
    const primaryDocument = (docs[i] ?? '').toString().trim()
    if (!form || !filingDate || !accessionNumber || !primaryDocument) continue
    filings.push({
      form,
      filingDate,
      url: secFilingUrl({ cik: matched.cik, accessionNumber, primaryDocument }),
    })
  }

  const citations = normalizeCitations([
    { url: submissionsUrl, source: 'SEC', type: 'submissions' },
    ...filings.map((f) => ({ url: f.url, title: `${matched.ticker} ${f.form}`, publishedAt: f.filingDate, source: 'SEC', type: 'filing' })),
  ])

  return {
    ok: true,
    payload: { matched, filings },
    citations,
    meta: { ticker: matched.ticker, cik: matched.cik, match: matched.match, status: res.status },
  }
}

export async function fetchSecFilingsByTicker(args: {
  ticker: string
}): Promise<
  | {
      ok: true
      payload: { matched: { cik: string; ticker: string; title: string; match: string }; filings: Array<{ form: string; filingDate: string; url: string }> }
      citations: NormalizedCitation[]
      meta: Record<string, unknown>
    }
  | { ok: false; payload: {}; citations: []; meta: Record<string, unknown> }
> {
  const tickers = await getTickersIndex()
  if (!tickers.ok || !tickers.index) {
    return { ok: false, payload: {}, citations: [], meta: { errorCode: 'sec_tickers_unavailable', ...tickers.meta } }
  }

  const matched = pickByTicker(tickers.index, args.ticker)
  if (!matched) {
    return { ok: false, payload: {}, citations: [], meta: { errorCode: 'sec_no_ticker_match' } }
  }

  await secRateLimit()
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${cik10(matched.cik)}.json`
  const res = await fetchJson<SecSubmissions>({
    url: submissionsUrl,
    timeoutMs: 9000,
    headers: { accept: 'application/json' },
  })
  if (!res.ok) {
    return { ok: false, payload: {}, citations: [], meta: { errorCode: res.errorCode, status: res.status, url: res.url } }
  }

  const recent = res.json.filings?.recent
  const forms = recent?.form ?? []
  const dates = recent?.filingDate ?? []
  const accessions = recent?.accessionNumber ?? []
  const docs = recent?.primaryDocument ?? []

  const filings: Array<{ form: string; filingDate: string; url: string }> = []
  for (let i = 0; i < Math.min(forms.length, dates.length, accessions.length, docs.length, 10); i++) {
    const form = (forms[i] ?? '').toString().trim()
    const filingDate = (dates[i] ?? '').toString().trim()
    const accessionNumber = (accessions[i] ?? '').toString().trim()
    const primaryDocument = (docs[i] ?? '').toString().trim()
    if (!form || !filingDate || !accessionNumber || !primaryDocument) continue
    filings.push({
      form,
      filingDate,
      url: secFilingUrl({ cik: matched.cik, accessionNumber, primaryDocument }),
    })
  }

  const citations = normalizeCitations([
    { url: submissionsUrl, source: 'SEC', type: 'submissions' },
    ...filings.map((f) => ({ url: f.url, title: `${matched.ticker} ${f.form}`, publishedAt: f.filingDate, source: 'SEC', type: 'filing' })),
  ])

  return {
    ok: true,
    payload: { matched, filings },
    citations,
    meta: { ticker: matched.ticker, cik: matched.cik, match: matched.match, status: res.status },
  }
}

