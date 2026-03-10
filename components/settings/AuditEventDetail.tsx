'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AuditLogRow } from '@/components/settings/AuditEventTable'

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta ?? {})) {
    const key = k.toLowerCase()
    if (key.includes('secret') || key.includes('token') || key.includes('password') || key.includes('payload') || key.includes('content')) continue
    if (typeof v === 'string') out[k] = v.length > 220 ? v.slice(0, 217) + '...' : v
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v
    else if (Array.isArray(v)) out[k] = v.slice(0, 10)
    else out[k] = '[object]'
  }
  return out
}

export function AuditEventDetail(props: { selected: AuditLogRow | null }) {
  if (!props.selected) return null
  const r = props.selected
  const meta = sanitizeMeta(r.meta ?? {})
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Event detail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
        <div className="text-foreground font-medium">{r.action}</div>
        <div className="text-xs text-muted-foreground">
          Actor: {r.actor.displayName ?? r.actor.email ?? r.actor.userId}
        </div>
        <div className="text-xs text-muted-foreground">
          Target: {r.target_type}
          {r.target_id ? ` · ${r.target_id}` : ''}
        </div>
        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meta (sanitized)</div>
          <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">{JSON.stringify(meta, null, 2)}</pre>
        </div>
      </CardContent>
    </Card>
  )
}

