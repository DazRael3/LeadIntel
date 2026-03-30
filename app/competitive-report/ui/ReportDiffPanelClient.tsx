"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { usePlan } from '@/components/PlanProvider'
import { track } from '@/lib/analytics'

type Snapshot = {
  id: string
  createdAt: string
  sourcesFetchedAt: string | null
  reportVersion: number
  reportMarkdown?: string
}

type Envelope =
  | { ok: true; data: { snapshots: Snapshot[] } }
  | { ok: false; error?: { message?: string } }

function fmt(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return iso
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return iso
  }
}

function extractSignalLines(markdown: string): string[] {
  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const out: string[] = []
  for (const l of lines) {
    const isBullet = l.startsWith('- ') || l.startsWith('* ')
    if (!isBullet) continue
    const text = l.replace(/^[-*]\s+/, '')
    const lower = text.toLowerCase()
    if (lower.includes('signal') || lower.includes('trigger') || lower.includes('why now') || lower.includes('momentum')) {
      out.push(text)
    }
    if (out.length >= 80) break
  }
  return out
}

function setDiff(prevMarkdown: string, nextMarkdown: string): { added: string[]; removed: string[] } {
  const prev = new Set(extractSignalLines(prevMarkdown))
  const next = new Set(extractSignalLines(nextMarkdown))
  const added = Array.from(next).filter((x) => !prev.has(x)).slice(0, 25)
  const removed = Array.from(prev).filter((x) => !next.has(x)).slice(0, 25)
  return { added, removed }
}

export function ReportDiffPanelClient(props: {
  reportId: string
  latestMarkdown: string
  previousMarkdown?: string | null
  latestSnapshotId?: string | null
}) {
  const { tier, capabilities } = usePlan()
  const allowed = capabilities.report_diff === true
  const canShow = allowed && tier !== 'starter'

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Envelope | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/competitive-report/snapshots?reportId=${encodeURIComponent(props.reportId)}&includeMarkdown=1`,
        {
        cache: 'no-store',
        credentials: 'include',
        }
      )
      const json = (await res.json().catch(() => null)) as Envelope | null
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [props.reportId])

  useEffect(() => {
    if (!canShow) return
    void refresh()
  }, [canShow, refresh])

  const model = useMemo(() => (data && data.ok === true ? data.data : null), [data])
  const diff = useMemo(() => {
    // Prefer server-loaded snapshot markdown (requires Closer+). Fall back to server-provided previous markdown when available.
    const snaps = model?.snapshots ?? []
    const latest = snaps[0]
    const previous = snaps[1]
    const prevMd =
      typeof previous?.reportMarkdown === 'string'
        ? previous.reportMarkdown
        : typeof props.previousMarkdown === 'string'
          ? props.previousMarkdown
          : null
    const nextMd = typeof latest?.reportMarkdown === 'string' ? latest.reportMarkdown : props.latestMarkdown
    if (!prevMd) return null
    return setDiff(prevMd, nextMd)
  }, [model?.snapshots, props.latestMarkdown, props.previousMarkdown])

  if (!canShow) return null

  const hasDiff = Boolean(diff && (diff.added.length > 0 || diff.removed.length > 0))

  return (
    <Card className="border-cyan-500/10 bg-background/30" data-testid="report-diff-panel">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Refresh + diff</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">What changed since your previous snapshot.</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Closer+</Badge>
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {loading && !model ? (
          <div>Loading snapshots…</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">Snapshots: {(model?.snapshots ?? []).length}</Badge>
              {(model?.snapshots ?? []).length > 0 ? <Badge variant="outline">Latest snapshot saved</Badge> : <Badge variant="secondary">No snapshot</Badge>}
            </div>

            {!diff ? (
              <div className="text-xs text-muted-foreground">
                No previous snapshot yet. Refresh sources once more to generate a second snapshot, then the diff will populate.
              </div>
            ) : hasDiff ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded border border-cyan-500/10 bg-card/30 p-3">
                  <div className="text-xs font-medium text-foreground">New signals</div>
                  {diff?.added.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                      {diff.added.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">No new signal lines detected.</div>
                  )}
                </div>
                <div className="rounded border border-cyan-500/10 bg-card/30 p-3">
                  <div className="text-xs font-medium text-foreground">Removed signals</div>
                  {diff?.removed.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                      {diff.removed.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">No removed signal lines detected.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                No changes detected in “signal-like” bullet lines. (This diff is intentionally conservative; it only compares clear signal bullets.)
              </div>
            )}

            {(model?.snapshots ?? []).length > 0 ? (
              <details className="rounded border border-cyan-500/10 bg-card/30 p-3">
                <summary className="cursor-pointer text-xs text-muted-foreground">Snapshot history</summary>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {(model?.snapshots ?? []).slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3">
                      <span className="truncate">{fmt(s.createdAt)}</span>
                      <span className="shrink-0">v{s.reportVersion}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                asChild
                size="sm"
                variant="outline"
                onClick={() => track('report_diff_open_watchlists_clicked', { tier })}
              >
                <Link href="/watchlists">Open watchlists</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

