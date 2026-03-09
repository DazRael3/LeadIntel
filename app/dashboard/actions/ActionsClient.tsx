'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type ActionQueueItem = {
  id: string
  action_type: string
  status: string
  lead_id: string | null
  destination_type: string | null
  destination_id: string | null
  reason: string | null
  error: string | null
  created_at: string
}

type Envelope = { ok: true; data: { items: ActionQueueItem[] } } | { ok: false; error?: { message?: string } }

function badgeForStatus(status: string): { label: string; className: string } {
  if (status === 'ready') return { label: 'Ready', className: 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10' }
  if (status === 'queued' || status === 'processing') return { label: 'Processing', className: 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10' }
  if (status === 'delivered') return { label: 'Delivered', className: 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10' }
  if (status === 'manual_review') return { label: 'Manual review', className: 'border-purple-500/30 text-purple-200 bg-purple-500/10' }
  if (status === 'failed' || status === 'blocked') return { label: 'Needs attention', className: 'border-red-500/30 text-red-200 bg-red-500/10' }
  return { label: status, className: 'border-muted-foreground/20 text-muted-foreground bg-muted/20' }
}

export function ActionsClient() {
  const { toast } = useToast()
  const [items, setItems] = useState<ActionQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deliveringId, setDeliveringId] = useState<string | null>(null)

  const readyCount = useMemo(() => items.filter((i) => i.status === 'ready').length, [items])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/workspace/actions/queue?status=all&limit=50', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Load failed', description: json && 'error' in json ? json.error?.message : 'Please try again.' })
        return
      }
      setItems(json.data.items ?? [])
      track('action_queue_viewed', { count: (json.data.items ?? []).length })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function deliver(queueItemId: string) {
    setDeliveringId(queueItemId)
    try {
      const res = await fetch(`/api/workspace/actions/queue/${encodeURIComponent(queueItemId)}/deliver`, { method: 'POST' })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Delivery failed', description: json?.error?.message ?? 'Please try again.' })
        return
      }
      toast({ variant: 'success', title: 'Queued', description: 'Delivery queued.' })
      await load()
    } finally {
      setDeliveringId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="actions-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Actions</h1>
            <p className="mt-1 text-sm text-muted-foreground">Workspace queue for handoffs and delivery tasks.</p>
          </div>
          <Badge variant="outline">{readyCount} ready</Badge>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Queue</CardTitle>
              <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? (
              <div>Loading…</div>
            ) : items.length === 0 ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
                No actions yet. Prepare a CRM or Sequencer handoff from an account to populate your queue.
              </div>
            ) : (
              <div className="overflow-hidden rounded border border-cyan-500/10">
                <table className="w-full text-xs">
                  <thead className="bg-background/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                      <th className="px-3 py-2 text-left">Next</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 50).map((i) => {
                      const b = badgeForStatus(i.status)
                      const canDeliver =
                        i.action_type === 'crm_handoff_prepared' || i.action_type === 'sequencer_handoff_prepared' || i.action_type === 'webhook_delivery'
                      return (
                        <tr key={i.id} className="border-t border-cyan-500/10">
                          <td className="px-3 py-2 text-foreground">{i.action_type}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={b.className}>
                              {b.label}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">{i.reason ?? '—'}</td>
                          <td className="px-3 py-2">
                            {i.status === 'ready' && canDeliver ? (
                              <Button
                                size="sm"
                                className="h-7 text-xs neon-border hover:glow-effect"
                                disabled={deliveringId === i.id}
                                onClick={() => void deliver(i.id)}
                              >
                                {deliveringId === i.id ? 'Queuing…' : 'Deliver'}
                              </Button>
                            ) : i.status === 'ready' && i.action_type === 'export_delivery' ? (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => (window.location.href = '/settings/exports')}>
                                Open exports
                              </Button>
                            ) : i.error ? (
                              <span className="text-muted-foreground">{i.error}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

