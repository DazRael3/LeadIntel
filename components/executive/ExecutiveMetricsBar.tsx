'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ExecutiveSummary } from '@/lib/executive/types'

export function ExecutiveMetricsBar(props: { summary: ExecutiveSummary }) {
  const m = props.summary.metrics
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardContent className="pt-4 flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">ready actions {m.actionQueueReady}</Badge>
        <Badge variant="outline">blocked {m.actionQueueBlocked}</Badge>
        <Badge variant="outline">approvals pending {m.approvalsPending}</Badge>
        <Badge variant="outline">delivery fails (7d) {m.deliveriesFailed7d}</Badge>
        <Badge variant="outline">strategic/named {m.strategicPrograms}</Badge>
      </CardContent>
    </Card>
  )
}

