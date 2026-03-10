'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WorkflowBenchmarkMetric } from '@/lib/benchmarking/types'

function bandLabel(band: WorkflowBenchmarkMetric['band']): { text: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (band === 'above_norm' || band === 'promising_pattern') return { text: 'Above norm', variant: 'default' }
  if (band === 'within_norm') return { text: 'Within norm', variant: 'secondary' }
  if (band === 'below_norm') return { text: 'Below norm', variant: 'destructive' }
  if (band === 'insufficient_evidence') return { text: 'Insufficient evidence', variant: 'secondary' }
  return { text: 'Mixed', variant: 'secondary' }
}

function fmtRange(r: { low: number; high: number; unit: 'ratio' | 'hours' | 'count' }): string {
  if (r.unit === 'hours') return `${Math.round(r.low)}–${Math.round(r.high)}h`
  if (r.unit === 'count') return `${Math.round(r.low)}–${Math.round(r.high)}`
  const low = Math.round(r.low * 100)
  const high = Math.round(r.high * 100)
  return `${low}–${high}%`
}

export function WorkflowBenchmarkCard(props: { metric: WorkflowBenchmarkMetric }) {
  const b = bandLabel(props.metric.band)
  const current = fmtRange(props.metric.current)
  const comparison = props.metric.comparison.range ? fmtRange(props.metric.comparison.range) : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-base">{props.metric.summary}</CardTitle>
          <div className="text-xs text-muted-foreground">{props.metric.comparison.note}</div>
        </div>
        <Badge variant={b.variant}>{b.text}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Current</span> <span className="font-medium text-foreground">{current}</span>
          </div>
          {comparison ? (
            <div className="text-sm">
              <span className="text-muted-foreground">Comparison</span> <span className="font-medium text-foreground">{comparison}</span>
            </div>
          ) : null}
        </div>

        {props.metric.limitationsNote ? <div className="text-xs text-muted-foreground">{props.metric.limitationsNote}</div> : null}
      </CardContent>
    </Card>
  )
}

