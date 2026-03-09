'use client'

import type { EmbedShortlist } from '@/lib/embed/types'
import { Badge } from '@/components/ui/badge'

export function ShortlistWidget(props: { data: EmbedShortlist }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Accounts: {props.data.accounts.length}</Badge>
        <Badge variant="outline">Workspace: {props.data.workspaceId}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium">Account</th>
              <th className="py-2 text-left font-medium">Program</th>
              <th className="py-2 text-left font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {props.data.accounts.map((a) => (
              <tr key={a.id} className="border-b border-border/60">
                <td className="py-2 pr-3">
                  <div className="font-medium text-foreground">{a.name ?? 'Account'}</div>
                  <div className="text-xs text-muted-foreground">{a.domain ?? '—'}</div>
                </td>
                <td className="py-2 pr-3">{a.programState}</td>
                <td className="py-2 pr-3">{new Date(a.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-muted-foreground">Computed {new Date(props.data.computedAt).toLocaleString()}</div>
    </div>
  )
}

