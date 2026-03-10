'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type DirectionalMetricCounts = {
  metric: string
  byVariant: Record<string, number>
  total: number
}

export type DirectionalExperimentResults = {
  experimentKey: string
  windowDays: number
  exposures: { total: number; byVariant: Record<string, number> }
  primaryMetrics: DirectionalMetricCounts[]
  secondaryMetrics: DirectionalMetricCounts[]
  note: string
}

export function ExperimentResultsTable(props: { results: DirectionalExperimentResults[] }) {
  if (props.results.length === 0) return null

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Directional experiment results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {props.results.map((r) => (
          <div key={r.experimentKey} className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-xs text-muted-foreground">{r.experimentKey}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{r.exposures.total} exposures</Badge>
                  {Object.entries(r.exposures.byVariant)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <Badge key={k} variant="outline">
                        {k}:{v}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <MetricBlock title="Primary metrics" metrics={r.primaryMetrics} />
              <MetricBlock title="Secondary metrics" metrics={r.secondaryMetrics} />
            </div>

            <div className="mt-2 text-xs text-muted-foreground">{r.note}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function MetricBlock(props: { title: string; metrics: DirectionalMetricCounts[] }) {
  return (
    <div className="rounded border border-cyan-500/10 bg-background/30 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{props.title}</div>
      <div className="mt-2 space-y-2">
        {props.metrics.length === 0 ? <div className="text-xs text-muted-foreground">None configured.</div> : null}
        {props.metrics.map((m) => (
          <div key={m.metric} className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-mono text-xs">{m.metric}</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{m.total}</Badge>
              {Object.entries(m.byVariant)
                .slice(0, 3)
                .map(([k, v]) => (
                  <Badge key={k} variant="outline">
                    {k}:{v}
                  </Badge>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

