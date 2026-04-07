"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { normalizeReportDraftInput } from '@/lib/reports/reportInput'

type GenerateResponse =
  | { ok: true; data: { reportId: string; reused?: boolean } }
  | { ok: false; error: { code?: string; message?: string; details?: unknown; requestId?: string } }

function parseAuto(raw: string | null): boolean {
  if (!raw) return false
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function pickFirstNonEmpty(sp: URLSearchParams, keys: string[]): string | null {
  for (const k of keys) {
    const v = sp.get(k)
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  return null
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

type JobState =
  | { status: 'running'; startedAtMs: number; minimized: boolean }
  | { status: 'error'; startedAtMs: number; minimized: boolean; message: string }
  | { status: 'done'; startedAtMs: number; minimized: boolean }

const STORAGE_KEY = 'li_report_generation_job_v1'

function loadJob(): JobState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const status = typeof parsed.status === 'string' ? parsed.status : null
    const startedAtMs = typeof parsed.startedAtMs === 'number' ? parsed.startedAtMs : null
    const minimized = typeof parsed.minimized === 'boolean' ? parsed.minimized : false
    const message = typeof parsed.message === 'string' ? parsed.message : ''
    if (!status || !startedAtMs) return null
    if (status !== 'running' && status !== 'error' && status !== 'done') return null
    if (status === 'error') return { status, startedAtMs, minimized, message }
    return { status, startedAtMs, minimized }
  } catch {
    return null
  }
}

function saveJob(job: JobState | null) {
  if (typeof window === 'undefined') return
  try {
    if (!job) {
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(job))
  } catch {
    // ignore
  }
}

function bubbleText(job: JobState, now: number): { pct: number; label: string; detail: string } {
  const elapsedMs = Math.max(0, now - job.startedAtMs)
  const pct = clampPercent((elapsedMs / 45000) * 100)
  if (job.status === 'error') {
    return { pct, label: 'Report failed', detail: job.message || 'Please try again.' }
  }
  if (job.status === 'done') {
    return { pct: 100, label: 'Report ready', detail: 'Opening…' }
  }
  return { pct, label: 'Building report', detail: job.minimized ? `${pct}%` : `${pct}% · ${Math.max(0, Math.ceil(elapsedMs / 1000))}s` }
}

export function ReportGenerationManager() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const [job, setJob] = useState<JobState | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inFlightRef = useRef(false)

  const auto = parseAuto(sp.get('auto'))
  const reportId = sp.get('id')

  const payload = useMemo(() => {
    const company = pickFirstNonEmpty(sp, ['company', 'name', 'company_name'])
    const url = pickFirstNonEmpty(sp, ['url', 'input_url', 'website', 'domain'])
    const ticker = pickFirstNonEmpty(sp, ['ticker', 'symbol'])
    const normalized = normalizeReportDraftInput({
      company_name: company ?? null,
      input_url: url ?? null,
      ticker: ticker ?? null,
    })
    return {
      company_name: normalized.companyName,
      input_url: normalized.inputUrl,
      ticker: normalized.ticker,
      hasInvalidAutoInput: normalized.hasInvalidInputUrl || normalized.hasInvalidTicker,
    }
  }, [sp])

  const canGenerate = Boolean(payload.company_name || payload.input_url || payload.ticker)
  const canAutoGenerate = Boolean(payload.input_url || payload.ticker)
  const onReportsHub = pathname === '/competitive-report'

  // Load persisted job and keep time ticking when visible.
  useEffect(() => {
    const loaded = loadJob()
    setJob(loaded)
  }, [])

  useEffect(() => {
    if (!job) {
      if (tickRef.current) clearInterval(tickRef.current)
      tickRef.current = null
      return
    }
    tickRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [job])

  // Start generation when on reports hub and `auto=1` and no selected id.
  useEffect(() => {
    if (!onReportsHub) return
    if (!auto) return
    if (reportId) return
    if (!canGenerate) return
    if (!canAutoGenerate) return
    if (payload.hasInvalidAutoInput) return
    if (inFlightRef.current) return
    if (job?.status === 'running') return

    inFlightRef.current = true
    const startedAtMs = Date.now()
    const next: JobState = { status: 'running', startedAtMs, minimized: false }
    setJob(next)
    saveJob(next)

    const run = async () => {
      try {
        const res = await fetch('/api/competitive-report/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            company_name: payload.company_name,
            input_url: payload.input_url,
            ticker: payload.ticker,
          }),
        })
        const json = (await res.json()) as GenerateResponse
        if (!json || typeof json !== 'object' || !('ok' in json)) {
          throw new Error('unexpected_response')
        }
        if (!json.ok) {
          const err: JobState = { status: 'error', startedAtMs, minimized: false, message: json.error?.message ?? 'Please try again.' }
          setJob(err)
          saveJob(err)
          return
        }
        const id = json.data.reportId
        const done: JobState = { status: 'done', startedAtMs, minimized: false }
        setJob(done)
        saveJob(done)
        router.push(`/competitive-report?id=${encodeURIComponent(id)}`)
        router.refresh()
        // After navigation intent is fired, clear the bubble quickly.
        setTimeout(() => {
          setJob(null)
          saveJob(null)
          inFlightRef.current = false
        }, 1200)
      } catch {
        const err: JobState = { status: 'error', startedAtMs, minimized: false, message: 'Network error. Please try again.' }
        setJob(err)
        saveJob(err)
      } finally {
        inFlightRef.current = false
      }
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReportsHub, auto, reportId, canGenerate, canAutoGenerate, payload])

  if (!job) return null

  const { pct, label, detail } = bubbleText(job, now)

  return (
    <div className="fixed bottom-4 right-4 z-[120]">
      <button
        type="button"
        onClick={() => {
          const next = { ...job, minimized: !job.minimized } as JobState
          setJob(next)
          saveJob(next)
        }}
        className="rounded-full border border-purple-400/30 bg-purple-600/20 backdrop-blur px-4 py-3 shadow-lg hover:bg-purple-600/25 transition"
        aria-label={job.minimized ? 'Expand generation progress' : 'Minimize generation progress'}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-700/30 border border-purple-400/30">
            <span className="text-blue-300 font-bold tabular-nums">{pct}%</span>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-foreground">{label}</div>
            {job.minimized ? null : <div className="text-xs text-muted-foreground">{detail}</div>}
          </div>
          {job.status === 'error' ? (
            <span
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setJob(null)
                saveJob(null)
              }}
              className="ml-2 text-xs text-purple-50/80 hover:text-purple-50"
              role="button"
              aria-label="Dismiss"
            >
              Close
            </span>
          ) : null}
        </div>
      </button>
    </div>
  )
}

