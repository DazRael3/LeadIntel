'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Review = {
  id: string
  target_type: 'crm_mapping' | 'opportunity_observation' | 'workflow_outcome_link'
  target_id: string
  status: 'verified' | 'ambiguous' | 'not_linked' | 'needs_review_later'
  note: string | null
  reviewed_at: string
}

type Envelope =
  | { ok: true; data: { workspaceId: string; queue: { crmMappings: Array<{ id: string; mapping_kind: string; crm_system: string; crm_object_id: string; verification_status: string; status: string; account_id: string | null; updated_at: string }> }; reviews: Review[] } }
  | { ok: false; error?: { message?: string } }

export function VerificationDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [queue, setQueue] = useState<Array<{ id: string; mapping_kind: string; crm_system: string; crm_object_id: string; verification_status: string; status: string; account_id: string | null; updated_at: string }>>(
    []
  )
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [targetType, setTargetType] = useState<Review['target_type']>('crm_mapping')
  const [targetId, setTargetId] = useState('')
  const [status, setStatus] = useState<Review['status']>('verified')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/revenue/verification', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      setWorkspaceId(json.data.workspaceId)
      setReviews(json.data.reviews ?? [])
      setQueue(json.data.queue?.crmMappings ?? [])
      track('verification_queue_viewed', { count: (json.data.reviews ?? []).length })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function createReview() {
    if (!targetId.trim()) {
      toast({ variant: 'destructive', title: 'Missing target id' })
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/revenue/verification', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetType, targetId: targetId.trim(), status, note: note.trim() ? note.trim() : null }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Save failed', description: json?.error?.message ?? 'Please try again.' })
        return
      }
      toast({ variant: 'success', title: 'Saved', description: 'Verification recorded.' })
      setNote('')
      setTargetId('')
      await load()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="verification-dashboard-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Verification</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Human verification of CRM linkage and downstream observations. This is not automatic attribution.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {workspaceId ? <Badge variant="outline">{workspaceId.slice(0, 8)}…</Badge> : null}
            <Badge variant="outline">{reviews.length} reviews</Badge>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Verification queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {loading ? <div>Loading…</div> : null}
            {!loading && queue.length === 0 ? <div>No items currently need review.</div> : null}
            {!loading && queue.length > 0 ? (
              <div className="space-y-2">
                {queue.slice(0, 25).map((q) => (
                  <div key={q.id} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          crm_mapping · {q.mapping_kind} · {q.crm_system} · {q.verification_status} · {new Date(q.updated_at).toLocaleString()}
                        </div>
                        <div className="mt-1 text-xs font-mono text-foreground break-all">{q.id}</div>
                        {q.account_id ? <div className="mt-1 text-xs text-muted-foreground">account {q.account_id}</div> : null}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTargetType('crm_mapping')
                          setTargetId(q.id)
                          setStatus('verified')
                        }}
                      >
                        Verify…
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Record verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <div className="text-xs text-muted-foreground">Target type</div>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as Review['target_type'])}
                  className="w-full rounded border border-cyan-500/10 bg-background/40 px-3 py-2 text-sm"
                >
                  <option value="crm_mapping">CRM mapping</option>
                  <option value="opportunity_observation">Opportunity observation</option>
                  <option value="workflow_outcome_link">Workflow→Outcome link</option>
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <div className="text-xs text-muted-foreground">Target id (UUID)</div>
                <input
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full rounded border border-cyan-500/10 bg-background/40 px-3 py-2 text-sm"
                  placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <div className="text-xs text-muted-foreground">Status</div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Review['status'])}
                  className="w-full rounded border border-cyan-500/10 bg-background/40 px-3 py-2 text-sm"
                >
                  <option value="verified">Verified</option>
                  <option value="ambiguous">Ambiguous</option>
                  <option value="not_linked">Not linked</option>
                  <option value="needs_review_later">Needs review later</option>
                </select>
              </label>
              <label className="space-y-1">
                <div className="text-xs text-muted-foreground">Note (optional)</div>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[40px]" placeholder="Short evidence note (no CRM secrets)." />
              </label>
            </div>

            <Button size="sm" className="neon-border hover:glow-effect" onClick={() => void createReview()} disabled={creating || loading}>
              {creating ? 'Saving…' : 'Save verification'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {loading ? <div>Loading…</div> : null}
            {!loading && reviews.length === 0 ? <div>No reviews yet.</div> : null}
            {!loading && reviews.length > 0 ? (
              <div className="space-y-2">
                {reviews.slice(0, 25).map((r) => (
                  <div key={r.id} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {r.target_type} · {new Date(r.reviewed_at).toLocaleString()}
                        </div>
                        <div className="mt-1 text-xs font-mono text-foreground break-all">{r.target_id}</div>
                        {r.note ? <div className="mt-1 text-xs text-muted-foreground">{r.note}</div> : null}
                      </div>
                      <Badge variant="outline">{r.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

