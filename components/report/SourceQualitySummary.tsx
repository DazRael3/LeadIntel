'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ReportSourceQualitySummary } from '@/lib/domain/data-quality'
import { deriveReportSourceQuality } from '@/lib/services/data-quality'
import { track } from '@/lib/analytics'

type Citation = { url?: unknown }

function countCitations(value: unknown): number {
  if (!Array.isArray(value)) return 0
  let n = 0
  for (const x of value) {
    if (!x || typeof x !== 'object') continue
    const c = x as Citation
    const url = typeof c.url === 'string' ? c.url.trim() : ''
    if (!url || !url.startsWith('http')) continue
    n++
  }
  return n
}

function badgeForQuality(q: ReportSourceQualitySummary['quality']): { label: string; className: string } {
  if (q === 'strong') return { label: 'Strong', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' }
  if (q === 'usable') return { label: 'Usable', className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' }
  return { label: 'Limited', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200' }
}

function badgeForFreshness(f: ReportSourceQualitySummary['freshness']): { label: string; className: string } {
  if (f === 'fresh') return { label: 'Fresh', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' }
  if (f === 'recent') return { label: 'Recent', className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' }
  if (f === 'stale') return { label: 'Stale', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200' }
  return { label: 'Unknown', className: 'border-slate-500/30 bg-slate-500/10 text-slate-200' }
}

export function SourceQualitySummary(props: { sourcesUsed: unknown; sourcesFetchedAt: string | null; meta: unknown }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const fired = useRef(false)

  const summary = useMemo(() => {
    const citationsCount = countCitations(props.sourcesUsed)
    return deriveReportSourceQuality({ citationsCount, sourcesFetchedAt: props.sourcesFetchedAt, meta: props.meta })
  }, [props.meta, props.sourcesFetchedAt, props.sourcesUsed])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (fired.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (fired.current) return
        fired.current = true
        track('data_quality_viewed', { surface: 'report', quality: summary.quality, freshness: summary.freshness })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [summary.freshness, summary.quality])

  const q = badgeForQuality(summary.quality)
  const f = badgeForFreshness(summary.freshness)

  return (
    <Card ref={ref} className="border-cyan-500/10 bg-background/30">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Source quality</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={q.className}>
              {q.label}
            </Badge>
            <Badge variant="outline" className={f.className}>
              {f.label}
            </Badge>
            <Badge variant="outline">Citations: {summary.citationsCount}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {summary.limitations.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1 text-xs">
            {summary.limitations.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-muted-foreground">Sources look healthy for this report.</div>
        )}
      </CardContent>
    </Card>
  )
}

