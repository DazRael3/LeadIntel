'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DataQualitySummary } from '@/lib/domain/data-quality'
import { track } from '@/lib/analytics'

function badgeForQuality(q: DataQualitySummary['quality']): { label: string; className: string } {
  if (q === 'strong') return { label: 'Strong', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' }
  if (q === 'usable') return { label: 'Usable', className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' }
  return { label: 'Limited', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200' }
}

function badgeForFreshness(f: DataQualitySummary['freshness']): { label: string; className: string } {
  if (f === 'fresh') return { label: 'Fresh', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' }
  if (f === 'recent') return { label: 'Recent', className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' }
  if (f === 'stale') return { label: 'Stale', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200' }
  return { label: 'Unknown', className: 'border-slate-500/30 bg-slate-500/10 text-slate-200' }
}

export function DataQualityCard(props: { quality: DataQualitySummary }) {
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
        track('data_quality_viewed', { quality: props.quality.quality, freshness: props.quality.freshness })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [props.quality.freshness, props.quality.quality])

  const q = badgeForQuality(props.quality.quality)
  const f = badgeForFreshness(props.quality.freshness)

  return (
    <Card ref={ref} className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Data quality</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={q.className}>
              {q.label}
            </Badge>
            <Badge variant="outline" className={f.className}>
              {f.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Signals</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {props.quality.coverage.signalEventsCount} events · {props.quality.coverage.uniqueSignalTypesCount} types
            </div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">First-party</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {props.quality.coverage.hasFirstPartyMatch ? `${props.quality.coverage.firstPartyVisitorCount14d} matches (14d)` : 'No match yet'}
            </div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Explainability</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {props.quality.completeness.hasScoreReasons ? 'Reasons' : 'Few reasons'} · {props.quality.completeness.hasMomentum ? 'Momentum' : 'No momentum'}
            </div>
          </div>
        </div>

        {props.quality.limitations.length > 0 ? (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-200">Limitations</div>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              {props.quality.limitations.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Coverage looks healthy for this account.</div>
        )}
      </CardContent>
    </Card>
  )
}

