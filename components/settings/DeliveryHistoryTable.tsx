import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DeliveryHistoryRow } from '@/lib/services/delivery-history'
import { webhookDeliveryStatusLabel, badgeClassForTone } from '@/lib/ui/status-labels'

function deliveryBadge(status: DeliveryHistoryRow['status']) {
  const st = status === 'failed' ? 'failed' : status === 'delivered' ? 'sent' : 'pending'
  const label = webhookDeliveryStatusLabel(st, st === 'pending' ? 1 : 0)
  return (
    <Badge variant="outline" className={badgeClassForTone(label.tone)}>
      {label.label}
    </Badge>
  )
}

export function DeliveryHistoryTable(props: { history: DeliveryHistoryRow[] }) {
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Recent delivery activity</CardTitle>
          <Badge variant="outline">Metadata-only</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {props.history.length === 0 ? (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">No deliveries yet.</div>
        ) : (
          <div className="overflow-hidden rounded border border-cyan-500/10">
            <table className="w-full text-xs">
              <thead className="bg-background/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Destination</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">When</th>
                </tr>
              </thead>
              <tbody>
                {props.history.slice(0, 20).map((h) => (
                  <tr key={h.id} className="border-t border-cyan-500/10">
                    <td className="px-3 py-2 text-foreground">{h.action_type}</td>
                    <td className="px-3 py-2">{h.destination_type}</td>
                    <td className="px-3 py-2">{deliveryBadge(h.status)}</td>
                    <td className="px-3 py-2">{new Date(h.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

