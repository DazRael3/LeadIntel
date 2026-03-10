'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SourceHealthSummary } from '@/lib/domain/source-health'
import { track } from '@/lib/analytics'
import { formatRelativeDate } from '@/lib/domain/explainability'

function badgeForFreshness(f: SourceHealthSummary['freshness']): { label: string; className: string } {
  if (f === 'fresh') return { label: 'Fresh', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' }
  if (f === 'recent') return { label: 'Recent', className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' }
  if (f === 'stale') return { label: 'Stale', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200' }
  return { label: 'Unknown', className: 'border-slate-500/30 bg-slate-500/10 text-slate-200' }
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return formatRelativeDate(iso)
}

export function SourceFreshnessCard(props: { health: SourceHealthSummary }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (fired.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (fired.current) return
        fired.current = true
        track('source_health_viewed', { freshness: props.health.freshness, window: props.health.window })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [props.health.freshness, props.health.window])

  const b = badgeForFreshness(props.health.freshness)

  return (
    <Card ref={ref} className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Source freshness</CardTitle>
          <Badge variant="outline" className={b.className}>
            {b.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest signal</div>
            <div className="mt-1 text-sm font-medium text-foreground">{fmt(props.health.lastSignalAt)}</div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest first-party visit</div>
            <div className="mt-1 text-sm font-medium text-foreground">{fmt(props.health.lastFirstPartyAt)}</div>
          </div>
        </div>
        {props.health.notes.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1 text-xs">
            {props.health.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}

