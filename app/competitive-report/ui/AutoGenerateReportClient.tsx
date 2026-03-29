"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

export function AutoGenerateReportClient() {
  const router = useRouter()
  const sp = useSearchParams()
  const startedAtRef = useRef<number>(0)
  const didStartRef = useRef(false)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [progress, setProgress] = useState<{ pct: number; seconds: number } | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<'running' | 'error' | 'done' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const auto = parseAuto(sp.get('auto'))
  const id = sp.get('id')

  const payload = useMemo(() => {
    const company = pickFirstNonEmpty(sp, ['company', 'name', 'company_name'])
    const url = pickFirstNonEmpty(sp, ['url', 'input_url', 'website', 'domain'])
    const ticker = pickFirstNonEmpty(sp, ['ticker', 'symbol'])
    return {
      company_name: company ?? null,
      input_url: url ?? null,
      ticker: ticker ?? null,
    }
  }, [sp])

  const canGenerate = Boolean(payload.company_name || payload.input_url || payload.ticker)

  useEffect(() => {
    // Only for hub auto-flow when there's no selected report yet.
    if (!auto) return
    if (id) return
    if (!canGenerate) return
    if (didStartRef.current) return
    didStartRef.current = true

    startedAtRef.current = Date.now()
    setVisible(true)
    setStatus('running')
    setMessage(null)
    setProgress({ pct: 0, seconds: 0 })

    // Lightweight progress ticker (not tied to backend; avoids request spam).
    tickRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAtRef.current
      // Target 45s "expected" completion for a human-friendly indicator.
      const pct = clampPercent((elapsedMs / 45000) * 100)
      const seconds = Math.max(0, Math.ceil(elapsedMs / 1000))
      setProgress({ pct, seconds })
    }, 1000)

    const run = async () => {
      try {
        const res = await fetch('/api/competitive-report/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = (await res.json()) as GenerateResponse
        if (!json || typeof json !== 'object' || !('ok' in json)) {
          throw new Error('unexpected_response')
        }
        if (!json.ok) {
          setStatus('error')
          setMessage(json.error?.message ?? 'Please try again.')
          return
        }

        const reportId = json.data.reportId
        setStatus('done')
        setMessage('Report saved.')
        router.push(`/competitive-report?id=${encodeURIComponent(reportId)}`)
        router.refresh()
      } catch {
        setStatus('error')
        setMessage('Network error. Please try again.')
      } finally {
        if (tickRef.current) {
          clearInterval(tickRef.current)
          tickRef.current = null
        }
      }
    }
    void run()

    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [auto, id, canGenerate, payload, router])

  if (!visible || !progress) return null

  const pct = progress.pct
  const seconds = progress.seconds
  const label =
    status === 'error'
      ? 'Report failed'
      : status === 'done'
        ? 'Report ready'
        : 'Building report'

  const detail =
    status === 'error'
      ? message ?? 'Please try again.'
      : status === 'done'
        ? message ?? 'Saved.'
        : minimized
          ? `${pct}%`
          : `${pct}% · ${seconds}s`

  return (
    <div className="fixed bottom-4 right-4 z-[120]">
      <button
        type="button"
        onClick={() => setMinimized((v) => !v)}
        className="rounded-full border border-purple-400/30 bg-purple-600/20 backdrop-blur px-4 py-3 shadow-lg hover:bg-purple-600/25 transition"
        aria-label={minimized ? 'Expand generation progress' : 'Minimize generation progress'}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-700/30 border border-purple-400/30">
            <span className="text-blue-300 font-bold tabular-nums">{pct}%</span>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-foreground">{label}</div>
            {minimized ? null : <div className="text-xs text-muted-foreground">{detail}</div>}
          </div>
        </div>
      </button>
    </div>
  )
}

