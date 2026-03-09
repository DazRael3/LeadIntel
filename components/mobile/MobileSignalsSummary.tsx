'use client'

import { Badge } from '@/components/ui/badge'
import type { SignalEvent, SignalMomentum } from '@/lib/domain/explainability'
import type { DataQualitySummary } from '@/lib/domain/data-quality'
import type { SourceHealthSummary } from '@/lib/domain/source-health'

function momentumTone(label: string): string {
  if (label === 'rising') return 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10'
  if (label === 'cooling') return 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10'
  return 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10'
}

export function MobileSignalsSummary(props: {
  momentum: SignalMomentum | null
  dataQuality: DataQualitySummary | null
  sourceHealth: SourceHealthSummary | null
  signals: SignalEvent[]
}) {
  const top = props.signals.slice(0, 3)
  const mom = props.momentum
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-2">
        {mom ? (
          <Badge variant="outline" className={momentumTone(mom.label)}>
            Momentum: {mom.label} ({mom.delta >= 0 ? '+' : ''}
            {mom.delta})
          </Badge>
        ) : (
          <Badge variant="outline">Momentum: —</Badge>
        )}
        {props.dataQuality ? (
          <Badge variant="outline">
            Quality: {props.dataQuality.quality} · {props.dataQuality.freshness}
          </Badge>
        ) : (
          <Badge variant="outline">Quality: —</Badge>
        )}
        {props.sourceHealth ? <Badge variant="outline">Sources: {props.sourceHealth.freshness}</Badge> : <Badge variant="outline">Sources: —</Badge>}
        <Badge variant="outline">Signals: {props.signals.length}</Badge>
      </div>

      {top.length > 0 ? (
        <div className="rounded border border-cyan-500/10 bg-background/30 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Top signals</div>
          <ul className="mt-2 space-y-2">
            {top.map((s) => (
              <li key={s.id} className="text-sm text-foreground">
                {s.title}
              </li>
            ))}
          </ul>
          <div className="mt-2 text-xs text-muted-foreground">
            Summary is derived from recent signals and freshness. Open details for full explainability.
          </div>
        </div>
      ) : (
        <div className="rounded border border-cyan-500/10 bg-background/30 p-3 text-xs text-muted-foreground">No signals yet.</div>
      )}
    </div>
  )
}

