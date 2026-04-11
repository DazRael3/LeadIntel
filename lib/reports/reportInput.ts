import { normalizeCompanyDomain, normalizeInputUrl } from '@/lib/sources/normalize'

export const MIN_CITATIONS = 2

export type ReportInput = {
  company_name?: string | null
  input_url?: string | null
  company_domain?: string | null
  ticker?: string | null
}

export type NormalizedReportDraftInput = {
  companyName: string | null
  inputUrl: string | null
  ticker: string | null
  hasInvalidInputUrl: boolean
  hasInvalidTicker: boolean
}

function safeTrim(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length > 0 ? s : null
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,10}$/

function normalizeTicker(raw: string | null): string | null {
  if (!raw) return null
  const ticker = raw.toUpperCase()
  return TICKER_RE.test(ticker) ? ticker : null
}

function normalizeReportInputUrl(raw: string | null): string | null {
  if (!raw) return null
  const normalized = normalizeInputUrl(raw)
  if (!normalized) return null
  try {
    const host = new URL(normalized).hostname
    const domain = normalizeCompanyDomain(host)
    if (!domain) return null
    return normalized
  } catch {
    return null
  }
}

export function normalizeReportDraftInput(raw: ReportInput): NormalizedReportDraftInput {
  const companyName = safeTrim(raw.company_name)?.slice(0, 120) ?? null
  const inputUrlRaw = safeTrim(raw.input_url)
  const tickerRaw = safeTrim(raw.ticker)

  const inputUrl = normalizeReportInputUrl(inputUrlRaw)
  const ticker = normalizeTicker(tickerRaw)

  return {
    companyName,
    inputUrl,
    ticker,
    hasInvalidInputUrl: Boolean(inputUrlRaw) && !inputUrl,
    hasInvalidTicker: Boolean(tickerRaw) && !ticker,
  }
}

export function normalizeReportInput(raw: unknown): {
  companyName: string | null
  inputUrl: string | null
  companyDomain: string | null
  ticker: string | null
  companyKey: string
} {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const inputUrlRaw = safeTrim(obj.input_url)
  const tickerRaw = safeTrim(obj.ticker)
  const companyDomainRaw = safeTrim(obj.company_domain)
  const draft = normalizeReportDraftInput({
    company_name: safeTrim(obj.company_name),
    input_url: inputUrlRaw,
    ticker: tickerRaw,
  })

  if (inputUrlRaw && draft.hasInvalidInputUrl) {
    throw new Error('VALIDATION_ERROR_INVALID_INPUT_URL')
  }
  if (tickerRaw && draft.hasInvalidTicker) {
    throw new Error('VALIDATION_ERROR_INVALID_TICKER')
  }

  const domainFromUrl = draft.inputUrl
    ? (() => {
        try {
          return normalizeCompanyDomain(new URL(draft.inputUrl).hostname)
        } catch {
          return null
        }
      })()
    : null

  const domainFromField = companyDomainRaw ? normalizeCompanyDomain(companyDomainRaw) : null
  if (companyDomainRaw && !domainFromField) {
    throw new Error('VALIDATION_ERROR_INVALID_COMPANY_DOMAIN')
  }
  const normalizedDomain = domainFromUrl ?? domainFromField

  const ticker = draft.ticker

  const companyKey =
    normalizedDomain
      ? normalizedDomain
      : ticker
        ? `ticker:${ticker}`
        : draft.companyName
          ? `name:${slug(draft.companyName)}`
          : (() => {
              throw new Error('VALIDATION_ERROR_MISSING_INPUT')
            })()

  return {
    companyName: draft.companyName,
    inputUrl: draft.inputUrl,
    companyDomain: normalizedDomain,
    ticker,
    companyKey,
  }
}

