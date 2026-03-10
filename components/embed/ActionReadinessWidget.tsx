'use client'

import type { EmbedReadiness } from '@/lib/embed/types'
import { Badge } from '@/components/ui/badge'

export function ActionReadinessWidget(props: { data: EmbedReadiness }) {
  const q = props.data.queue
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Ready: {q.ready}</Badge>
        <Badge variant="outline">Queued: {q.queued}</Badge>
        <Badge variant="outline">Processing: {q.processing}</Badge>
        <Badge variant="outline">Delivered: {q.delivered}</Badge>
        <Badge variant="outline">Failed: {q.failed}</Badge>
        <Badge variant="outline">Blocked: {q.blocked}</Badge>
        <Badge variant="outline">Manual review: {q.manualReview}</Badge>
        <Badge variant="outline">Approvals pending: {props.data.approvalsPending}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">Computed {new Date(props.data.computedAt).toLocaleString()}</div>
    </div>
  )
}

