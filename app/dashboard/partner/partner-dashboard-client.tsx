'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Health = {
  readiness: { label: string; needsAttention: number }
  approvalsPending: number
  queueReadyBacklog48h: number
  webhookFailures7d: number
  lastActivityAt: string | null
}

type WorkspaceRow = {
  workspace: { id: string; name: string; owner_user_id: string; created_at: string }
  role: string
  source: 'direct' | 'delegated'
  health: Health
}

type Envelope =
  | { success: true; data: { currentWorkspaceId: string; workspaces: WorkspaceRow[] } }
  | { success: false; error?: { message?: string } }

function labelBadge(label: string): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (label === 'healthy') return { text: 'Healthy', variant: 'default' }
  if (label === 'needs_setup') return { text: 'Needs setup', variant: 'destructive' }
  if (label === 'blocked') return { text: 'Blocked', variant: 'destructive' }
  if (label === 'stalled') return { text: 'Stalled', variant: 'secondary' }
  return { text: 'Unknown', variant: 'outline' }
}

export function PartnerDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<WorkspaceRow[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/partners/workspaces', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      const errMsg = json && json.success === false ? json.error?.message : null
      if (!res.ok || !json || json.success !== true) throw new Error(errMsg ?? 'Failed to load workspaces')
      setRows(json.data.workspaces ?? [])
      setCurrentWorkspaceId(json.data.currentWorkspaceId ?? null)
      track('partner_dashboard_viewed', { workspacesCount: (json.data.workspaces ?? []).length })
    } catch (e) {
      toast({ title: 'Partner view unavailable', description: e instanceof Error ? e.message : 'Failed to load', variant: 'destructive' })
      setRows([])
      setCurrentWorkspaceId(null)
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

  async function switchTo(workspaceId: string) {
    const res = await fetch('/api/workspaces/switch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId }) })
    const json = (await res.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null
    if (!res.ok || !json || json.success !== true) {
      toast({ title: 'Switch failed', description: json?.error?.message ?? 'Please try again.', variant: 'destructive' })
      return
    }
    track('client_workspace_opened', { workspaceId })
    window.location.href = '/dashboard'
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Partner / multi-workspace overview</CardTitle>
            <div className="text-sm text-muted-foreground">
              Summary-only view across your accessible workspaces. Client account data stays inside each workspace context.
            </div>
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
          <CardTitle className="text-base">Accessible workspaces</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
          {!loading && rows.length === 0 ? <div className="text-sm text-muted-foreground">No additional workspaces found.</div> : null}
          {rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left font-medium">Workspace</th>
                  <th className="py-2 text-left font-medium">Access</th>
                  <th className="py-2 text-left font-medium">Health</th>
                  <th className="py-2 text-left font-medium">Approvals</th>
                  <th className="py-2 text-left font-medium">Backlog</th>
                  <th className="py-2 text-left font-medium">Failures</th>
                  <th className="py-2 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const b = labelBadge(r.health.readiness.label)
                  const isCurrent = currentWorkspaceId === r.workspace.id
                  return (
                    <tr key={r.workspace.id} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-foreground">{r.workspace.name}</div>
                        <div className="text-xs text-muted-foreground">{r.workspace.id}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline">{r.role}</Badge>{' '}
                        {r.source === 'delegated' ? <Badge variant="outline">delegated</Badge> : null}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={b.variant}>{b.text}</Badge>
                      </td>
                      <td className="py-2 pr-3">{r.health.approvalsPending}</td>
                      <td className="py-2 pr-3">{r.health.queueReadyBacklog48h}</td>
                      <td className="py-2 pr-3">{r.health.webhookFailures7d}</td>
                      <td className="py-2 text-right">
                        <Button variant={isCurrent ? 'secondary' : 'default'} size="sm" onClick={() => void switchTo(r.workspace.id)}>
                          {isCurrent ? 'Current' : 'Open'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

