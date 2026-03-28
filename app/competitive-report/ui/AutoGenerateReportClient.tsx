"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/components/ui/use-toast'
import { ToastAction } from '@/components/ui/toast'

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
  const [minimized, setMinimized] = useState(false)
  const startedAtRef = useRef<number>(0)
  const didStartRef = useRef(false)
  const toastHandleRef = useRef<ReturnType<typeof toast> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    const initialTitle = 'Generating report…'
    const initialDesc = minimized ? 'Starting…' : 'Fetching sources and drafting a citation-backed report.'
    toastHandleRef.current = toast({
      title: initialTitle,
      description: initialDesc,
      duration: Infinity,
      action: (
        <ToastAction altText={minimized ? 'Expand' : 'Minimize'} onClick={() => setMinimized((v) => !v)}>
          {minimized ? 'Expand' : 'Minimize'}
        </ToastAction>
      ),
    })

    // Lightweight progress ticker (not tied to backend; avoids request spam).
    tickRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAtRef.current
      // Target 45s "expected" completion for a human-friendly indicator.
      const pct = clampPercent((elapsedMs / 45000) * 100)
      const seconds = Math.max(0, Math.ceil(elapsedMs / 1000))
      const desc = minimized ? `Generating… ${pct}%` : `Generating… ${pct}% (${seconds}s)`
      toastHandleRef.current?.update({
        title: 'Generating report…',
        description: desc,
        duration: Infinity,
        action: (
          <ToastAction altText={minimized ? 'Expand' : 'Minimize'} onClick={() => setMinimized((v) => !v)}>
            {minimized ? 'Expand' : 'Minimize'}
          </ToastAction>
        ),
      } as any)
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
          toastHandleRef.current?.dismiss()
          toast({
            variant: 'destructive',
            title: 'Report generation failed',
            description: json.error?.message ?? 'Please try again.',
          })
          return
        }

        const reportId = json.data.reportId
        toastHandleRef.current?.dismiss()
        toast({
          variant: 'success',
          title: 'Report ready',
          description: 'Your report was generated and saved.',
          action: (
            <ToastAction altText="View report" onClick={() => router.push(`/competitive-report?id=${encodeURIComponent(reportId)}`)}>
              View
            </ToastAction>
          ),
        })
        router.push(`/competitive-report?id=${encodeURIComponent(reportId)}`)
        router.refresh()
      } catch {
        toastHandleRef.current?.dismiss()
        toast({ variant: 'destructive', title: 'Network error', description: 'Please try again.' })
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
  }, [auto, id, canGenerate, minimized, payload, router])

  return null
}

