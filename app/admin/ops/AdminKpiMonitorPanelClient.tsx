'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type LatestRun = {
  startedAt: string | null
  finishedAt: string | null
  status: string
  reason: string | null
  alerts: number
  actionableAlerts: number
  insufficientRows: number
}

type LatestRow = {
  metric: string
  window: '24h' | '7d'
  current: number
  previous: number
  drop_pct: number
  alert: boolean
  note: string | null
}

type LatestEnvelope =
  | { ok: true; data: { latestRun: LatestRun | null; rows: LatestRow[] } }
  | { ok: false; error?: { message?: string } }

type TrendPoint = { date: string; metric: string; window: '24h' | '7d'; current: number }

type TrendsEnvelope =
  | { ok: true; data: { days: number; points: TrendPoint[] } }
  | { ok: false; error?: { message?: string } }

function formatRelative(iso: string | null): string {
  if (!iso) return 'unknown'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 'unknown'
  const diffMs = Date.now() - t
  const s = Math.max(0, Math.floor(diffMs / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function sparkline(points: number[], width = 260, height = 44): string {
  const n = points.length
  if (n === 0) return ''
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = Math.max(1, max - min)
  const stepX = n === 1 ? 0 : width / (n - 1)
  return points
    .map((v, i) => {
      const x = i * stepX
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function AdminKpiMonitorPanelClient(props: { token: string | null }) {
  const [latest, setLatest] = useState<LatestEnvelope | null>(null)
  const [trends, setTrends] = useState<TrendsEnvelope | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<string>('landing_try_sample_submitted')
  const [selectedWindow, setSelectedWindow] = useState<'24h' | '7d'>('24h')

  async function load() {
    if (!props.token) {
      setLatest({ ok: false, error: { message: 'Admin token missing.' } })
      setTrends({ ok: false, error: { message: 'Admin token missing.' } })
      return
    }
    setLoading(true)
    try {
      const adminHeaders = { 'x-admin-token': props.token }
      const [l, t] = await Promise.all([
        fetch('/api/admin/kpi-monitor/latest', { cache: 'no-store', headers: adminHeaders }).then((r) => r.json()),
        fetch('/api/admin/kpi-monitor/trends?days=14', { cache: 'no-store', headers: adminHeaders }).then((r) => r.json()),
      ])
      setLatest(l as LatestEnvelope)
      setTrends(t as TrendsEnvelope)
    } catch {
      setLatest({ ok: false, error: { message: 'Failed to load KPI monitor data' } })
      setTrends({ ok: false, error: { message: 'Failed to load KPI monitor trends' } })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token is stable for the session
  }, [])

  const latestRows = useMemo(() => (latest?.ok ? latest.data.rows : []), [latest])
  const latestRun = useMemo(() => (latest?.ok ? latest.data.latestRun : null), [latest])

  const metrics = useMemo(() => {
    const set = new Set<string>()
    for (const r of latestRows) set.add(r.metric)
    const list = Array.from(set)
    list.sort()
    return list.length > 0 ? list : [selectedMetric]
  }, [latestRows, selectedMetric])

  const trendSeries = useMemo(() => {
    if (!trends?.ok) return []
    return trends.data.points
      .filter((p) => p.metric === selectedMetric && p.window === selectedWindow)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [trends, selectedMetric, selectedWindow])

  const sparkPoints = useMemo(() => trendSeries.map((p) => p.current), [trendSeries])
  const polyline = useMemo(() => sparkline(sparkPoints), [sparkPoints])

  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">KPI Monitor</CardTitle>
            <div className="text-xs text-muted-foreground">
              {latestRun?.finishedAt ? (
                <>
                  Last run: {formatRelative(latestRun.finishedAt)} · Status: {latestRun.status}
                  {latestRun.reason ? ` · Reason: ${latestRun.reason}` : ''}
                </>
              ) : (
                'No runs recorded yet.'
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>
        {latestRun ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">Alerts: {latestRun.alerts}</Badge>
            <Badge variant="outline">Actionable: {latestRun.actionableAlerts}</Badge>
            <Badge variant="outline">Insufficient: {latestRun.insufficientRows}</Badge>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-6">
        {latest?.ok === false ? (
          <div className="text-sm text-muted-foreground">{latest.error?.message ?? 'Failed to load KPI monitor.'}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                <th className="text-left py-2 pr-3">Metric</th>
                <th className="text-left py-2 pr-3">Window</th>
                <th className="text-left py-2 pr-3">Current</th>
                <th className="text-left py-2 pr-3">Previous</th>
                <th className="text-left py-2 pr-3">Drop %</th>
                <th className="text-left py-2 pr-3">Note</th>
                <th className="text-left py-2">Alert</th>
              </tr>
            </thead>
            <tbody>
              {latestRows.length > 0 ? (
                latestRows.map((r, idx) => (
                  <tr key={`${r.metric}-${r.window}-${idx}`} className="border-b border-cyan-500/10">
                    <td className="py-2 pr-3 font-medium text-foreground">{r.metric}</td>
                    <td className="py-2 pr-3">{r.window}</td>
                    <td className="py-2 pr-3">{r.current}</td>
                    <td className="py-2 pr-3">{r.previous}</td>
                    <td className="py-2 pr-3">{r.drop_pct.toFixed(1)}%</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{r.note ?? ''}</td>
                    <td className="py-2">
                      <Badge variant={r.alert ? 'destructive' : 'outline'}>{r.alert ? 'alert' : '—'}</Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-3 text-sm text-muted-foreground" colSpan={7}>
                    No KPI rows available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-foreground">Trends (14 days)</div>
              <div className="text-xs text-muted-foreground">Latest snapshot per day.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded border border-cyan-500/20 bg-background px-2 text-sm"
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
              >
                {metrics.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded border border-cyan-500/20 bg-background px-2 text-sm"
                value={selectedWindow}
                onChange={(e) => setSelectedWindow(e.target.value as '24h' | '7d')}
              >
                <option value="24h">24h</option>
                <option value="7d">7d</option>
              </select>
            </div>
          </div>

          {trends?.ok === false ? (
            <div className="mt-2 text-sm text-muted-foreground">{trends.error?.message ?? 'Failed to load trends.'}</div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-start gap-4">
            <svg width={260} height={44} viewBox="0 0 260 44" className="rounded bg-background/40">
              {polyline ? (
                <polyline fill="none" stroke="currentColor" strokeWidth="2" points={polyline} className="text-cyan-400" />
              ) : null}
            </svg>
            <div className="min-w-[240px] text-xs text-muted-foreground">
              {trendSeries.length > 0 ? (
                <ul className="space-y-1">
                  {trendSeries.slice(-7).map((p) => (
                    <li key={`${p.date}-${p.metric}-${p.window}`}>
                      <span className="text-foreground">{p.date}</span> · {p.current}
                    </li>
                  ))}
                </ul>
              ) : (
                <div>No trend points yet.</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

