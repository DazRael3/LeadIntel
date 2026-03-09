'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Envelope =
  | {
      ok: true
      data: {
        workspace: { id: string; name: string }
        role: 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'
        feedbackAgg: Array<{ kind: string; count: number }>
        outcomeAgg: Array<{ outcome: string; count: number }>
      }
    }
  | { ok: false; error?: { message?: string } }

export function IntelligenceDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<Extract<Envelope, { ok: true }>['data'] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workspace/intelligence/insights', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Unable to load intelligence.' })
        setPayload(null)
        return
      }
      setPayload(json.data)
      track('next_best_action_viewed', { surface: 'dashboard_intelligence' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="intelligence-dashboard-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Intelligence</h1>
            <p className="mt-1 text-sm text-muted-foreground">Workflow-focused learning signals (no fake precision).</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{payload?.workspace.name ?? 'Workspace'}</Badge>
            {payload ? <Badge variant="outline">role {payload.role}</Badge> : null}
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recommendation feedback (top)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? (
              <div>Loading…</div>
            ) : !payload ? (
              <div className="text-xs text-muted-foreground">No data.</div>
            ) : payload.feedbackAgg.length === 0 ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
                No feedback submitted yet. Use “Useful / Not useful” on account recommendations to start building evidence.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {payload.feedbackAgg.map((x) => (
                  <Badge key={x.kind} variant="outline" className="border-cyan-500/20 text-muted-foreground bg-muted/20">
                    {x.kind}: {x.count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Outcomes (top)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? (
              <div>Loading…</div>
            ) : !payload ? (
              <div className="text-xs text-muted-foreground">No data.</div>
            ) : payload.outcomeAgg.length === 0 ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
                No outcomes recorded yet. Use the Outcome card on accounts to track explicit results without attribution claims.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {payload.outcomeAgg.map((x) => (
                  <Badge key={x.outcome} variant="outline" className="border-cyan-500/20 text-muted-foreground bg-muted/20">
                    {x.outcome}: {x.count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Controls</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>
              Adaptive behavior is controlled via <a className="text-cyan-400 hover:underline" href="/settings/intelligence">Intelligence settings</a>.
            </div>
            <div className="text-xs text-muted-foreground">
              This view focuses on recommendation usefulness and evidence quality. It is not rep surveillance.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

