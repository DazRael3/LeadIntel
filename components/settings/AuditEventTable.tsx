'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type AuditActor = { userId: string; email: string | null; displayName: string | null }

export type AuditLogRow = {
  id: string
  action: string
  target_type: string
  target_id: string | null
  meta: Record<string, unknown>
  created_at: string
  actor: AuditActor
}

export function AuditEventTable(props: {
  loading: boolean
  rows: AuditLogRow[]
  onSelect: (row: AuditLogRow) => void
}) {
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Events</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {props.loading ? (
          <div>Loading…</div>
        ) : props.rows.length === 0 ? (
          <div>No events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Actor</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2 pr-2">Meta</th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-cyan-500/10 cursor-pointer hover:bg-background/40"
                    onClick={() => props.onSelect(r)}
                    data-testid={`audit-row-${r.id}`}
                  >
                    <td className="py-2 pr-4">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{r.actor.displayName ?? r.actor.email ?? r.actor.userId}</td>
                    <td className="py-2 pr-4 text-foreground">{r.action}</td>
                    <td className="py-2 pr-4">
                      {r.target_type}
                      {r.target_id ? ` · ${r.target_id}` : ''}
                    </td>
                    <td className="py-2 pr-2">
                      <span className="text-xs">{Object.keys(r.meta ?? {}).slice(0, 3).join(', ') || '—'}</span>
                    </td>
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

