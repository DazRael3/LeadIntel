'use client'

import { Badge } from '@/components/ui/badge'
import type { FirstPartyIntentSummary } from '@/lib/domain/explainability'

export function IntentSummaryBar(props: {
  summary: FirstPartyIntentSummary
  visitorCount: number
  lastVisitedAtLabel: string | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{props.summary.labelText}</Badge>
      <Badge variant="outline">{props.visitorCount} signals</Badge>
      {props.lastVisitedAtLabel ? <Badge variant="outline">Freshness: {props.lastVisitedAtLabel}</Badge> : null}
    </div>
  )
}

