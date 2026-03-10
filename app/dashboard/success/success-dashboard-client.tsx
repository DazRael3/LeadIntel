'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

type Summary = {
  type: 'adoption_health_summary'
  workspaceId: string
  windowDays: number
  health: 'limited' | 'usable' | 'strong'
  reasonSummary: string
  signals: Array<{ key: string; label: string; value: number; note: string }>
  limitationsNote: string
  computedAt: string
}

type Envelope = { ok: true; data: Summary } | { ok: false; error?: { message?: string } }

export function SuccessDashboardClient() {
  const [loading, setLoading] = useState(true)
  const [windowDays, setWindowDays] = useState(30)
  const [summary, setSummary] = useState<Summary | null>(null)

  const load = useCallback(async (days: number) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('windowDays', String(days))
      const res = await fetch(`/api/customer-success/health?${qs.toString()}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        setSummary(null)
        return
      }
      setSummary(json.data)
      track('workspace_health_viewed', { windowDays: days })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(windowDays)
  }, [load, windowDays])

  const badgeTone = useMemo(() => {
    const h = summary?.health ?? 'limited'
    if (h === 'strong') return 'border-green-500/30 text-green-300 bg-green-500/10'
    if (h === 'usable') return 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10'
    return 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10'
  }, [summary?.health])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="success-dashboard-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Success</h1>
            <p className="mt-1 text-sm text-muted-foreground">Observed adoption and workflow health (bounded, explainable).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={windowDays === 7 ? 'default' : 'outline'} onClick={() => setWindowDays(7)}>
              7d
            </Button>
            <Button size="sm" variant={windowDays === 30 ? 'default' : 'outline'} onClick={() => setWindowDays(30)}>
              30d
            </Button>
            <Button size="sm" variant={windowDays === 90 ? 'default' : 'outline'} onClick={() => setWindowDays(90)}>
              90d
            </Button>
            <Button size="sm" variant="outline" onClick={() => void load(windowDays)} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Adoption health</CardTitle>
              {summary ? (
                <Badge variant="outline" className={badgeTone}>
                  {summary.health}
                </Badge>
              ) : (
                <Badge variant="outline">Unavailable</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {loading ? <div>Loading…</div> : null}
            {!loading && !summary ? <div className="rounded border border-cyan-500/10 bg-background/40 p-3">Unavailable.</div> : null}
            {!loading && summary ? (
              <>
                <div className="text-sm text-foreground">{summary.reasonSummary}</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {summary.signals.map((s) => (
                    <div key={s.key} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-foreground font-medium">{s.label}</div>
                        <Badge variant="outline">{s.value}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{s.note}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">{summary.limitationsNote}</div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

