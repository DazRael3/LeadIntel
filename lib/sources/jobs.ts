import { fetchJson, fetchText } from '@/lib/sources/http'
import type { NormalizedCitation } from '@/lib/sources/normalize'
import { normalizeCitations, normalizeCompanyDomain } from '@/lib/sources/normalize'

type AtsDetection =
  | { kind: 'greenhouse'; boardToken: string; careersUrl: string }
  | { kind: 'lever'; companyToken: string; careersUrl: string }
  | { kind: 'none'; careersUrlTried: string | null }

function findGreenhouseBoardToken(html: string): string | null {
  // Common patterns: boards.greenhouse.io/<token> or greenhouse.io/<token>
  const re = /(https?:\/\/boards\.greenhouse\.io\/)([a-z0-9_-]{2,80})/gi
  const m = re.exec(html)
  if (m && m[2]) return m[2].toLowerCase()
  const re2 = /(https?:\/\/(?:www\.)?greenhouse\.io\/)([a-z0-9_-]{2,80})/gi
  const m2 = re2.exec(html)
  if (m2 && m2[2]) return m2[2].toLowerCase()
  return null
}

function findLeverCompanyToken(html: string): string | null {
  // Common patterns: jobs.lever.co/<company> or api.lever.co/v0/postings/<company>
  const re = /(https?:\/\/jobs\.lever\.co\/)([a-z0-9_-]{2,80})/gi
  const m = re.exec(html)
  if (m && m[2]) return m[2].toLowerCase()
  const re2 = /(https?:\/\/api\.lever\.co\/v0\/postings\/)([a-z0-9_-]{2,80})/gi
  const m2 = re2.exec(html)
  if (m2 && m2[2]) return m2[2].toLowerCase()
  return null
}

async function detectAts(args: { baseOrigin: string }): Promise<AtsDetection> {
  const candidates = ['/careers', '/jobs']
  for (const path of candidates) {
    const careersUrl = `${args.baseOrigin}${path}`
    const res = await fetchText({ url: careersUrl, timeoutMs: 6500, headers: { accept: 'text/html' } })
    if (!res.ok) continue
    const html = res.text
    const gh = findGreenhouseBoardToken(html)
    if (gh) return { kind: 'greenhouse', boardToken: gh, careersUrl: res.url }
    const lever = findLeverCompanyToken(html)
    if (lever) return { kind: 'lever', companyToken: lever, careersUrl: res.url }
  }
  return { kind: 'none', careersUrlTried: `${args.baseOrigin}/careers` }
}

type GreenhouseJob = { title?: string; location?: { name?: string }; departments?: Array<{ name?: string }> }
type GreenhouseResponse = { jobs?: GreenhouseJob[] }

type LeverJob = { text?: string; categories?: { location?: string; team?: string } }
type LeverResponse = LeverJob[]

export async function fetchHiringSignals(args: {
  companyDomain: string | null
  inputUrl: string | null
}): Promise<
  | {
      ok: true
      sourceType: 'greenhouse' | 'lever'
      payload: {
        careersUrl: string
        boardUrl: string
        totalOpenRoles: number
        byDepartment: Record<string, number>
        sampleRoles: Array<{ title: string; department?: string; location?: string }>
      }
      citations: NormalizedCitation[]
      meta: Record<string, unknown>
    }
  | { ok: false; sourceType: null; payload: {}; citations: []; meta: Record<string, unknown> }
> {
  const domain = args.companyDomain ? normalizeCompanyDomain(args.companyDomain) : null
  const baseOrigin = args.inputUrl
    ? (() => {
        try {
          return new URL(args.inputUrl).origin
        } catch {
          return null
        }
      })()
    : domain
      ? `https://${domain}`
      : null

  if (!baseOrigin) return { ok: false, sourceType: null, payload: {}, citations: [], meta: { errorCode: 'missing_base_url' } }

  const detection = await detectAts({ baseOrigin })
  if (detection.kind === 'none') {
    return { ok: false, sourceType: null, payload: {}, citations: [], meta: { errorCode: 'ats_not_detected', baseOrigin } }
  }

  if (detection.kind === 'greenhouse') {
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(detection.boardToken)}/jobs?content=true`
    const res = await fetchJson<GreenhouseResponse>({ url: apiUrl, timeoutMs: 8000 })
    if (!res.ok) {
      return {
        ok: false,
        sourceType: null,
        payload: {},
        citations: [],
        meta: { errorCode: res.errorCode, status: res.status, apiUrl: res.url, careersUrl: detection.careersUrl },
      }
    }
    const jobs = (res.json.jobs ?? []) as GreenhouseJob[]
    const byDepartment: Record<string, number> = {}
    const sampleRoles: Array<{ title: string; department?: string; location?: string }> = []
    for (const j of jobs) {
      const title = typeof j.title === 'string' ? j.title.trim() : ''
      if (!title) continue
      const dept = j.departments?.[0]?.name && typeof j.departments[0].name === 'string' ? j.departments[0].name.trim() : undefined
      const loc = j.location?.name && typeof j.location.name === 'string' ? j.location.name.trim() : undefined
      if (dept) byDepartment[dept] = (byDepartment[dept] ?? 0) + 1
      if (sampleRoles.length < 10) sampleRoles.push({ title, department: dept, location: loc })
    }
    const citations = normalizeCitations([
      { url: detection.careersUrl, source: domain ?? baseOrigin, type: 'careers' },
      { url: apiUrl, source: 'Greenhouse', type: 'ats_api' },
    ])
    return {
      ok: true,
      sourceType: 'greenhouse',
      payload: {
        careersUrl: detection.careersUrl,
        boardUrl: `https://boards.greenhouse.io/${detection.boardToken}`,
        totalOpenRoles: jobs.length,
        byDepartment,
        sampleRoles,
      },
      citations,
      meta: { apiStatus: res.status, boardToken: detection.boardToken },
    }
  }

  const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(detection.companyToken)}?mode=json`
  const res = await fetchJson<LeverResponse>({ url: apiUrl, timeoutMs: 8000 })
  if (!res.ok) {
    return {
      ok: false,
      sourceType: null,
      payload: {},
      citations: [],
      meta: { errorCode: res.errorCode, status: res.status, apiUrl: res.url, careersUrl: detection.careersUrl },
    }
  }
  const jobs = (Array.isArray(res.json) ? res.json : []) as LeverJob[]
  const byDepartment: Record<string, number> = {}
  const sampleRoles: Array<{ title: string; department?: string; location?: string }> = []
  for (const j of jobs) {
    const title = typeof j.text === 'string' ? j.text.trim() : ''
    if (!title) continue
    const dept = typeof j.categories?.team === 'string' ? j.categories.team.trim() : undefined
    const loc = typeof j.categories?.location === 'string' ? j.categories.location.trim() : undefined
    if (dept) byDepartment[dept] = (byDepartment[dept] ?? 0) + 1
    if (sampleRoles.length < 10) sampleRoles.push({ title, department: dept, location: loc })
  }
  const citations = normalizeCitations([
    { url: detection.careersUrl, source: domain ?? baseOrigin, type: 'careers' },
    { url: apiUrl, source: 'Lever', type: 'ats_api' },
  ])
  return {
    ok: true,
    sourceType: 'lever',
    payload: {
      careersUrl: detection.careersUrl,
      boardUrl: `https://jobs.lever.co/${detection.companyToken}`,
      totalOpenRoles: jobs.length,
      byDepartment,
      sampleRoles,
    },
    citations,
    meta: { apiStatus: res.status, companyToken: detection.companyToken },
  }
}

