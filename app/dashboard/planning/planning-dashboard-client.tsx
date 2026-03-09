'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type QueueItem = {
  id: string
  leadId: string | null
  actionType: string
  status: string
  reason: string | null
  error: string | null
  createdAt: string
  companyName: string | null
  companyDomain: string | null
}

type Summary = {
  workspaceId: string
  computedAt: string
  buckets: {
    workNow: QueueItem[]
    blocked: QueueItem[]
    waitingOnReview: QueueItem[]
    needsFollowThrough: QueueItem[]
    deliveredRecently: QueueItem[]
  }
}

type PlanningEnvelope =
  | { ok: true; data: { workspace: { id: string; name: string }; role: string; summary: Summary } }
  | { ok: false; error?: { message?: string } }

type ForecastEnvelope =
  | {
      ok: true
      data: {
        summary: {
          buckets: Array<{ label: string; title: string; description: string; counts: { queueItems: number; delivered: number; outcomes: number }; caution: string }>
          limitationsNote: string | null
        }
      }
    }
  | { ok: false; error?: { message?: string } }

function nameForItem(i: QueueItem): string {
  const parts = [(i.companyName ?? '').trim(), (i.companyDomain ?? '').trim()].filter(Boolean)
  if (parts.length > 0) return parts.join(' · ')
  if (i.leadId) return `Account ${i.leadId.slice(0, 8)}…`
  return i.id.slice(0, 8) + '…'
}

export function PlanningDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [forecastBuckets, setForecastBuckets] = useState<Array<{ title: string; counts: { queueItems: number; delivered: number; outcomes: number }; caution: string }>>([])
  const [workspaceName, setWorkspaceName] = useState<string>('Workspace')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [planRes, forecastRes] = await Promise.all([
        fetch('/api/team/planning?limit=100', { cache: 'no-store' }),
        fetch('/api/team/forecast-support', { cache: 'no-store' }),
      ])

      const planJson = (await planRes.json().catch(() => null)) as PlanningEnvelope | null
      if (!planRes.ok || !planJson || planJson.ok !== true) {
        toast({ variant: 'destructive', title: 'Planning unavailable', description: planJson && 'error' in planJson ? planJson.error?.message : 'Please try again.' })
        setSummary(null)
        return
      }

      setWorkspaceName(planJson.data.workspace.name)
      setSummary(planJson.data.summary)

      const fJson = (await forecastRes.json().catch(() => null)) as ForecastEnvelope | null
      if (forecastRes.ok && fJson && fJson.ok === true) {
        setForecastBuckets(
          (fJson.data.summary.buckets ?? []).map((b) => ({
            title: b.title,
            counts: b.counts,
            caution: b.caution,
          }))
        )
      } else {
        setForecastBuckets([])
      }

      track('weekly_planning_board_viewed', { surface: 'dashboard_planning' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    if (!summary) return null
    return {
      now: summary.buckets.workNow.length,
      blocked: summary.buckets.blocked.length + summary.buckets.waitingOnReview.length,
      follow: summary.buckets.needsFollowThrough.length,
    }
  }, [summary])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="planning-dashboard-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Planning</h1>
            <p className="mt-1 text-sm text-muted-foreground">Weekly execution board (workflow-oriented, not a forecast system).</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workspaceName}</Badge>
            {counts ? <Badge variant="outline">{counts.now} work now</Badge> : null}
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Forecast support (directional)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            {loading ? (
              <div>Loading…</div>
            ) : forecastBuckets.length === 0 ? (
              <div className="text-xs text-muted-foreground">No forecast support summary available yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {forecastBuckets.slice(0, 4).map((b) => (
                  <div key={b.title} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                    <div className="text-foreground font-medium">{b.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      queue {b.counts.queueItems} · delivered {b.counts.delivered} · outcomes {b.counts.outcomes}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{b.caution}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              This is directional workflow support—not close prediction, not revenue attribution, and not a commit forecast.
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-cyan-500/20 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Work now</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {loading ? (
                <div>Loading…</div>
              ) : !summary || summary.buckets.workNow.length === 0 ? (
                <div className="text-xs text-muted-foreground">No ready actions right now.</div>
              ) : (
                <ul className="space-y-2">
                  {summary.buckets.workNow.slice(0, 10).map((i) => (
                    <li key={i.id} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-foreground font-medium">{nameForItem(i)}</div>
                        <Badge variant="outline" className="border-cyan-500/20 text-muted-foreground bg-muted/20">
                          {i.actionType}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{i.reason ?? '—'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Needs follow-through</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {loading ? (
                <div>Loading…</div>
              ) : !summary || summary.buckets.needsFollowThrough.length === 0 ? (
                <div className="text-xs text-muted-foreground">No follow-through gaps detected.</div>
              ) : (
                <ul className="space-y-2">
                  {summary.buckets.needsFollowThrough.slice(0, 10).map((i) => (
                    <li key={i.id} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-foreground font-medium">{nameForItem(i)}</div>
                        <Badge variant="outline" className="border-yellow-500/30 text-yellow-200 bg-yellow-500/10">
                          {i.status}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{i.reason ?? 'Prepared but not delivered yet.'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Blocked / needs attention</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {loading ? (
                <div>Loading…</div>
              ) : !summary || (summary.buckets.blocked.length === 0 && summary.buckets.waitingOnReview.length === 0) ? (
                <div className="text-xs text-muted-foreground">No blockers right now.</div>
              ) : (
                <ul className="space-y-2">
                  {[...summary.buckets.blocked, ...summary.buckets.waitingOnReview].slice(0, 10).map((i) => (
                    <li key={i.id} className="rounded border border-red-500/10 bg-red-500/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-foreground font-medium">{nameForItem(i)}</div>
                        <Badge variant="outline" className="border-red-500/30 text-red-200 bg-red-500/10">
                          {i.status}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{i.error ?? i.reason ?? '—'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Delivered recently</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {loading ? (
                <div>Loading…</div>
              ) : !summary || summary.buckets.deliveredRecently.length === 0 ? (
                <div className="text-xs text-muted-foreground">No deliveries yet.</div>
              ) : (
                <ul className="space-y-2">
                  {summary.buckets.deliveredRecently.slice(0, 10).map((i) => (
                    <li key={i.id} className="rounded border border-emerald-500/10 bg-emerald-500/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-foreground font-medium">{nameForItem(i)}</div>
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-200 bg-emerald-500/10">
                          delivered
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{i.actionType}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-xs text-muted-foreground">
          Note: account names may be hidden for items created by other workspace members due to tenant/RLS boundaries. Planning remains workflow-oriented.
        </div>
      </div>
    </div>
  )
}

