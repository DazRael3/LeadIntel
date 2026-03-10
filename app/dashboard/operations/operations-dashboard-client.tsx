'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Row = {
  workspace: { id: string; name: string }
  health: { approvalsPending: number; queueReadyBacklog48h: number; webhookFailures7d: number; readiness: { label: string; needsAttention: number } }
}

type Envelope =
  | { success: true; data: { workspaces: Row[] } }
  | { success: false; error?: { message?: string } }

export function OperationsDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/partners/workspaces', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      const err = json && json.success === false ? json.error?.message : null
      if (!res.ok || !json || json.success !== true) throw new Error(err ?? 'Failed to load')
      setRows((json.data.workspaces ?? []) as any)
      track('multiworkspace_operations_viewed', { surface: 'dashboard_operations' })
    } catch (e) {
      toast({ title: 'Operations unavailable', description: e instanceof Error ? e.message : 'Failed to load', variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    let approvals = 0
    let backlog = 0
    let failures = 0
    for (const r of rows) {
      approvals += r.health.approvalsPending ?? 0
      backlog += r.health.queueReadyBacklog48h ?? 0
      failures += r.health.webhookFailures7d ?? 0
    }
    return { approvals, backlog, failures }
  }, [rows])

  const attention = useMemo(() => rows.filter((r) => r.health.queueReadyBacklog48h > 0 || r.health.approvalsPending > 0 || r.health.webhookFailures7d > 0).slice(0, 12), [rows])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Operations</CardTitle>
            <div className="text-sm text-muted-foreground">Summary-safe multi-workspace health. Open a workspace to see details.</div>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">Approvals pending: {totals.approvals}</Badge>
          <Badge variant="outline">Ready backlog (48h+): {totals.backlog}</Badge>
          <Badge variant="outline">Webhook failures (7d): {totals.failures}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Needs attention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {attention.length === 0 ? <div className="text-sm text-muted-foreground">No workspace-level blockers detected.</div> : null}
          {attention.map((r) => (
            <div key={r.workspace.id} className="rounded border border-border/60 bg-background/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-foreground">{r.workspace.name}</div>
                <Badge variant="outline">{r.health.readiness.label}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Approvals: {r.health.approvalsPending}</span>
                <span>Backlog: {r.health.queueReadyBacklog48h}</span>
                <span>Failures: {r.health.webhookFailures7d}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

