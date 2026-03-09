'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import { CompactReadinessBadge } from '@/components/summary/CompactReadinessBadge'

type QueueItem = { id: string; leadId: string | null; actionType: string; status: string; reason: string | null; companyName: string | null; companyDomain: string | null }
type Summary = { buckets: { workNow: QueueItem[]; blocked: QueueItem[]; waitingOnReview: QueueItem[]; needsFollowThrough: QueueItem[] } }
type Envelope = { ok: true; data: { summary: Summary; workspace: { id: string; name: string } } } | { ok: false; error?: { message?: string } }

function labelFor(i: QueueItem): string {
  const parts = [(i.companyName ?? '').trim(), (i.companyDomain ?? '').trim()].filter(Boolean)
  if (parts.length > 0) return parts.join(' · ')
  if (i.leadId) return `Account ${i.leadId.slice(0, 8)}…`
  return i.id.slice(0, 8) + '…'
}

function readinessForBucket(bucket: 'workNow' | 'blocked' | 'waitingOnReview' | 'needsFollowThrough'): 'ready' | 'blocked' | 'waiting' | 'stale' {
  if (bucket === 'workNow') return 'ready'
  if (bucket === 'blocked') return 'blocked'
  if (bucket === 'waitingOnReview') return 'waiting'
  return 'stale'
}

export function MobileShortlistView() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('Workspace')
  const [summary, setSummary] = useState<Summary | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/team/planning?limit=50', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) throw new Error(json && 'error' in json ? json.error?.message : 'Load failed')
      setWorkspaceName(json.data.workspace.name)
      setSummary(json.data.summary)
      track('mobile_shortlist_viewed', { surface: 'dashboard_mobile_shortlist' })
    } catch (e) {
      toast({ title: 'Shortlist unavailable', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' })
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const buckets = useMemo(() => {
    const b = summary?.buckets
    if (!b) return []
    return [
      { key: 'workNow' as const, title: 'Act now', items: b.workNow.slice(0, 8) },
      { key: 'needsFollowThrough' as const, title: 'Needs follow-through', items: b.needsFollowThrough.slice(0, 8) },
      { key: 'waitingOnReview' as const, title: 'Waiting on review', items: b.waitingOnReview.slice(0, 8) },
      { key: 'blocked' as const, title: 'Blocked', items: b.blocked.slice(0, 8) },
    ]
  }, [summary])

  return (
    <div className="md:hidden space-y-4" data-testid="mobile-shortlist">
      <Card className="border-cyan-500/20 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Daily shortlist</CardTitle>
              <div className="mt-1 text-xs text-muted-foreground">Fast triage for {workspaceName}.</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {loading ? <div>Loading…</div> : null}
          {!loading && buckets.every((b) => b.items.length === 0) ? (
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
              No priority items right now. When handoffs are prepared or approvals are pending, they’ll show here.
            </div>
          ) : null}

          <div className="space-y-3">
            {buckets.map((b) => (
              <div key={b.key} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-foreground font-medium">{b.title}</div>
                  <Badge variant="outline">{b.items.length}</Badge>
                </div>
                <div className="mt-2 space-y-2">
                  {b.items.map((i) => (
                    <div key={i.id} className="rounded border border-border/60 bg-background/20 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-foreground text-sm font-medium">{labelFor(i)}</div>
                        <CompactReadinessBadge label={readinessForBucket(b.key)} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{i.reason ?? i.actionType}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground">
            This is a summary view based on observed workflow activity (queue + approvals). It is not real-time.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

