import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type ActionQueueRow = {
  id: string
  action_type: string
  status: string
  reason: string | null
  created_at: string
}

function badgeForStatus(status: string): { label: string; className: string } {
  if (status === 'ready') return { label: 'Ready', className: 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10' }
  if (status === 'manual_review') return { label: 'Review', className: 'border-purple-500/30 text-purple-200 bg-purple-500/10' }
  if (status === 'failed' || status === 'blocked') return { label: 'Needs attention', className: 'border-red-500/30 text-red-200 bg-red-500/10' }
  return { label: status, className: 'border-muted-foreground/20 text-muted-foreground bg-muted/20' }
}

export function ActionQueueTable(props: { items: ActionQueueRow[] }) {
  return (
    <div className="overflow-hidden rounded border border-cyan-500/10">
      <table className="w-full text-xs">
        <thead className="bg-background/60 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Action</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Next</th>
          </tr>
        </thead>
        <tbody>
          {props.items.slice(0, 5).map((i) => {
            const b = badgeForStatus(i.status)
            return (
              <tr key={i.id} className="border-t border-cyan-500/10">
                <td className="px-3 py-2 text-foreground">
                  <div className="font-medium">{i.action_type}</div>
                  <div className="text-muted-foreground">{i.reason ?? '—'}</div>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={b.className}>
                    {b.label}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => (window.location.href = '/dashboard/actions')}>
                    Open
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

