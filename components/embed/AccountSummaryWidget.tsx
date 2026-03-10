'use client'

import type { EmbedAccountSummary } from '@/lib/embed/types'
import { Badge } from '@/components/ui/badge'

export function AccountSummaryWidget(props: { data: EmbedAccountSummary }) {
  const a = props.data.account
  const r = props.data.readiness
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-medium text-foreground">{a.name ?? 'Account'}</div>
        <div className="text-xs text-muted-foreground">{a.domain ?? '—'}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Program: {a.programState}</Badge>
        <Badge variant="outline">Ready: {r.ready}</Badge>
        <Badge variant="outline">Blocked: {r.blocked}</Badge>
        <Badge variant="outline">Failed: {r.failed}</Badge>
        <Badge variant="outline">Approvals pending: {r.approvalsPending}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">Computed {new Date(props.data.computedAt).toLocaleString()}</div>
    </div>
  )
}

