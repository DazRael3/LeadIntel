'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import { CommentThreadPanel } from '@/components/collab/CommentThreadPanel'

type ApprovalRow = {
  id: string
  target_type: 'template'
  target_id: string
  status: 'draft' | 'pending_review' | 'changes_requested' | 'approved' | 'archived'
  note: string | null
  updated_at: string
}

type Envelope =
  | { ok: true; data: { workspace: { id: string; name: string }; role: string; rows: ApprovalRow[] } }
  | { ok: false; error?: { message?: string } }

function badgeFor(status: ApprovalRow['status']): { label: string; cls: string } {
  if (status === 'pending_review') return { label: 'Pending', cls: 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10' }
  if (status === 'changes_requested') return { label: 'Changes', cls: 'border-purple-500/30 text-purple-200 bg-purple-500/10' }
  if (status === 'approved') return { label: 'Approved', cls: 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10' }
  if (status === 'archived') return { label: 'Archived', cls: 'border-muted-foreground/20 text-muted-foreground bg-muted/20' }
  return { label: 'Draft', cls: 'border-cyan-500/20 text-muted-foreground bg-muted/20' }
}

export function ApprovalsDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ApprovalRow[]>([])
  const [workspaceName, setWorkspaceName] = useState('Workspace')
  const [role, setRole] = useState<string>('viewer')
  const [openId, setOpenId] = useState<string | null>(null)

  const isPrivileged = role === 'owner' || role === 'admin' || role === 'manager'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/team/approvals?status=pending_review&limit=100', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Approvals unavailable', description: json && 'error' in json ? json.error?.message : 'Please try again.' })
        return
      }
      setRows(json.data.rows ?? [])
      setWorkspaceName(json.data.workspace.name)
      setRole(json.data.role)
      track('mobile_approval_queue_viewed', { surface: 'dashboard_approvals', count: (json.data.rows ?? []).length })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const openRow = useMemo(() => rows.find((r) => r.id === openId) ?? null, [openId, rows])

  async function setStatus(id: string, status: ApprovalRow['status']) {
    if (!isPrivileged) {
      toast({ variant: 'destructive', title: 'Access restricted' })
      return
    }
    const res = await fetch('/api/team/approvals/item', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
      toast({ variant: 'destructive', title: 'Update failed', description: json?.error?.message ?? 'Please try again.' })
      return
    }
    toast({ variant: 'success', title: 'Updated', description: `Marked ${status.replace('_', ' ')}.` })
    setOpenId(null)
    await load()
  }

  async function approve(row: ApprovalRow) {
    if (!isPrivileged) {
      toast({ variant: 'destructive', title: 'Access restricted' })
      return
    }
    // Approve the underlying asset first, then mark the approval request.
    const res = await fetch('/api/team/templates/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: row.target_id }),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
      toast({ variant: 'destructive', title: 'Approve failed', description: json?.error?.message ?? 'Please try again.' })
      return
    }
    await setStatus(row.id, 'approved')
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="approvals-dashboard-page">
      <div className="container mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Approvals</h1>
            <p className="mt-1 text-sm text-muted-foreground">Fast review queue for shared assets (no premium body content shown here).</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workspaceName}</Badge>
            <Badge variant="outline">role {role}</Badge>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending review</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? (
              <div>Loading…</div>
            ) : rows.length === 0 ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
                No pending approvals right now.
              </div>
            ) : (
              <>
                <div className="md:hidden space-y-2">
                  {rows.slice(0, 50).map((r) => {
                    const b = badgeFor(r.status)
                    return (
                      <button
                        key={r.id}
                        className="w-full text-left rounded border border-cyan-500/10 bg-background/40 p-3 hover:bg-cyan-500/5"
                        onClick={() => setOpenId(r.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-foreground font-medium">Template review</div>
                          <Badge variant="outline" className={b.cls}>
                            {b.label}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{r.note ?? 'Open to review context and comments.'}</div>
                      </button>
                    )
                  })}
                </div>

                <div className="hidden md:block overflow-hidden rounded border border-cyan-500/10">
                  <table className="w-full text-xs">
                    <thead className="bg-background/60 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Target</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Note</th>
                        <th className="px-3 py-2 text-left">Next</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r) => {
                        const b = badgeFor(r.status)
                        return (
                          <tr key={r.id} className="border-t border-cyan-500/10">
                            <td className="px-3 py-2 text-foreground">template</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className={b.cls}>
                                {b.label}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">{r.note ?? '—'}</td>
                            <td className="px-3 py-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpenId(r.id)}>
                                Review
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <MobileActionSheet open={Boolean(openRow)} title="Review" onClose={() => setOpenId(null)}>
        {openRow ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <div className="text-foreground font-medium">Template review</div>
              <Badge variant="outline" className={badgeFor(openRow.status).cls}>
                {badgeFor(openRow.status).label}
              </Badge>
            </div>

            <div className="rounded border border-cyan-500/10 bg-background/30 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Context</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Approval target IDs are intentionally not expanded into full template bodies in this view.
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Target: <span className="text-foreground">{openRow.target_id}</span>
              </div>
            </div>

            <div className="rounded border border-cyan-500/10 bg-background/30 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Comments</div>
              <div className="mt-2">
                <CommentThreadPanel targetType="template" targetId={openRow.target_id} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="neon-border hover:glow-effect" onClick={() => void approve(openRow)} disabled={!isPrivileged}>
                Approve
              </Button>
              <Button variant="outline" onClick={() => void setStatus(openRow.id, 'changes_requested')} disabled={!isPrivileged}>
                Request changes
              </Button>
              <Button variant="outline" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </div>

            {!isPrivileged ? (
              <div className="text-xs text-muted-foreground">Only owner/admin/manager can approve or request changes.</div>
            ) : null}
          </div>
        ) : null}
      </MobileActionSheet>
    </div>
  )
}

