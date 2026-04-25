'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import { ExperimentResultsTable, type DirectionalExperimentResults } from '@/components/growth/ExperimentResultsTable'
import { ScalingMetricsCard } from '@/components/dashboard/ScalingMetricsCard'

type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived' | 'rolled_out' | 'reverted'
type Experiment = {
  id: string
  key: string
  name: string
  surface: string
  status: ExperimentStatus
  rolloutPercent: number
  variants: Array<{ key: string; name: string; weight: number }>
  primaryMetrics: string[]
  updatedAt: string
}

type Envelope =
  | {
      ok: true
      data: {
        workspaceId: string
        windowDays: number
        since: string
        experiments: Experiment[]
        exposures: Record<string, { total: number; byVariant: Record<string, number> }>
        growthEventCounts: Record<string, number>
        directionalResults?: DirectionalExperimentResults[]
        lifecycle?: { counts: Record<string, number>; sampleSize: number; note: string }
        retention?: { signals: Array<{ key: string; label: string; state: 'good' | 'caution'; detail: string }>; note: string }
        note: string
      }
    }
  | { ok: false; error?: { message?: string } }

function topEntries(map: Record<string, number>, limit: number): Array<{ key: string; value: number }> {
  return Object.entries(map)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

export function GrowthDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Envelope | null>(null)
  const [windowDays, setWindowDays] = useState(30)

  useEffect(() => {
    track('growth_dashboard_viewed', { surface: 'dashboard_growth' })
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/growth/insights?windowDays=${encodeURIComponent(String(windowDays))}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        setData(null)
        return
      }
      setData(json)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on windowDays only
  }, [windowDays])

  const okData = data && data.ok === true ? data.data : null

  const exposureTotals = useMemo(() => {
    if (!okData) return 0
    return Object.values(okData.exposures).reduce((acc, v) => acc + (v.total ?? 0), 0)
  }, [okData])

  const topEvents = useMemo(() => (okData ? topEntries(okData.growthEventCounts, 8) : []), [okData])

  if (loading && !okData) {
    return (
      <div className="min-h-screen bg-background terminal-grid">
        <div className="container mx-auto px-6 py-8 text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (!okData) {
    return (
      <div className="min-h-screen bg-background terminal-grid">
        <div className="container mx-auto px-6 py-8 text-muted-foreground">Growth insights unavailable.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="growth-dashboard-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Growth</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Directional operational visibility: experiment exposures + growth events (not statistical significance).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">window {okData.windowDays}d</Badge>
            <Badge variant="outline">{exposureTotals} exposures</Badge>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Funnel signals</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{new Date(okData.since).toLocaleDateString()}</Badge>
                <Button size="sm" variant="outline" onClick={() => setWindowDays((d) => (d === 30 ? 14 : d === 14 ? 7 : 30))}>
                  Toggle window
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {topEvents.map((e) => (
                <div key={e.key} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs">{e.key}</div>
                    <Badge variant="outline">{e.value}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">{okData.note}</div>
          </CardContent>
        </Card>

        <ScalingMetricsCard />

        {okData.lifecycle ? (
          <Card className="border-cyan-500/20 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Lifecycle (workspace)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{okData.lifecycle.sampleSize} members</Badge>
                {Object.entries(okData.lifecycle.counts)
                  .filter(([, v]) => typeof v === 'number' && v > 0)
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <Badge key={k} variant="outline">
                      {k}:{v}
                    </Badge>
                  ))}
              </div>
              <div className="text-xs text-muted-foreground">{okData.lifecycle.note}</div>
            </CardContent>
          </Card>
        ) : null}

        {okData.retention ? (
          <Card className="border-cyan-500/20 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Retention signals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {okData.retention.signals.map((s) => (
                  <div key={s.key} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-foreground">{s.label}</div>
                      <Badge variant="outline" className={s.state === 'good' ? 'border-green-500/30 text-green-300 bg-green-500/10' : 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10'}>
                        {s.state}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{s.detail}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">{okData.retention.note}</div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active experiments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {okData.experiments.length === 0 ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-4 text-sm text-muted-foreground">No experiments configured.</div>
            ) : (
              <div className="space-y-3">
                {okData.experiments.map((exp) => {
                  const exposure = okData.exposures[exp.key] ?? null
                  const byVariant = exposure?.byVariant ?? {}
                  return (
                    <div key={exp.id} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{exp.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="font-mono">{exp.key}</span> · surface <span className="font-mono">{exp.surface}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline">status {exp.status}</Badge>
                            <Badge variant="outline">rollout {exp.rolloutPercent}%</Badge>
                            {exp.primaryMetrics?.[0] ? <Badge variant="outline">primary {exp.primaryMetrics[0]}</Badge> : null}
                            <Badge variant="outline">{exposure?.total ?? 0} exposures</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {Object.keys(byVariant).length === 0 ? (
                            <div className="text-xs text-muted-foreground">No exposure breakdown yet.</div>
                          ) : (
                            Object.entries(byVariant)
                              .slice(0, 3)
                              .map(([k, v]) => (
                                <Badge key={k} variant="outline">
                                  {k}:{v}
                                </Badge>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {Array.isArray(okData.directionalResults) ? <ExperimentResultsTable results={okData.directionalResults} /> : null}
      </div>
    </div>
  )
}

