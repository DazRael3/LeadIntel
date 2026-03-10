'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { ExecutiveSummary } from '@/lib/executive/types'
import { ExecutiveMetricsBar } from '@/components/executive/ExecutiveMetricsBar'
import { ExecutiveHighlightsBoard } from '@/components/executive/ExecutiveHighlightsBoard'
import { ExecutiveRisksBoard } from '@/components/executive/ExecutiveRisksBoard'
import { ExecutiveMethodNote } from '@/components/executive/ExecutiveMethodNote'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'

type Envelope =
  | { ok: true; data: { workspace: { id: string; name: string }; role: string; summary: ExecutiveSummary } }
  | { ok: false; error?: { message?: string } }

export function ExecutiveDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('Workspace')
  const [role, setRole] = useState('viewer')
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotMarkdown, setSnapshotMarkdown] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/executive', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Executive view unavailable', description: json && 'error' in json ? json.error?.message : 'Please try again.' })
        setSummary(null)
        return
      }
      setWorkspaceName(json.data.workspace.name)
      setRole(json.data.role)
      setSummary(json.data.summary)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="executive-dashboard-page">
      <div className="container mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Executive</h1>
            <p className="mt-1 text-sm text-muted-foreground">Bounded workflow summary. No forecasting claims. No premium body exposure.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workspaceName}</Badge>
            <Badge variant="outline">role {role}</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                setSnapshotOpen(true)
                if (snapshotMarkdown) return
                setSnapshotLoading(true)
                try {
                  const res = await fetch('/api/executive/snapshot', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ format: 'markdown' }),
                  })
                  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { snapshot?: { markdown?: string } }; error?: { message?: string } } | null
                  if (!res.ok || !json || json.ok !== true) {
                    toast({ variant: 'destructive', title: 'Snapshot unavailable', description: json?.error?.message ?? 'Please try again.' })
                    return
                  }
                  setSnapshotMarkdown(typeof json.data?.snapshot?.markdown === 'string' ? json.data.snapshot.markdown : null)
                } finally {
                  setSnapshotLoading(false)
                }
              }}
              disabled={loading}
            >
              Snapshot
            </Button>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <Card className="border-cyan-500/20 bg-card/50">
            <CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent>
          </Card>
        ) : !summary ? (
          <Card className="border-cyan-500/20 bg-card/50">
            <CardContent className="py-10 text-center text-muted-foreground">No executive summary available.</CardContent>
          </Card>
        ) : (
          <>
            <ExecutiveMetricsBar summary={summary} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ExecutiveHighlightsBoard title="Highlights" items={summary.highlights} />
              <ExecutiveRisksBoard items={summary.risks} />
            </div>
            <ExecutiveMethodNote note={summary.limitationsNote} />
          </>
        )}
      </div>

      <MobileActionSheet open={snapshotOpen} title="Executive snapshot" onClose={() => setSnapshotOpen(false)}>
        <div className="space-y-3 text-sm text-muted-foreground">
          {snapshotLoading ? <div>Generating…</div> : null}
          {!snapshotLoading && snapshotMarkdown ? (
            <>
              <div className="rounded border border-cyan-500/10 bg-background/30 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Markdown (safe summary)</div>
                <pre className="mt-2 max-h-[45vh] overflow-auto whitespace-pre-wrap text-xs text-foreground">{snapshotMarkdown}</pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="neon-border hover:glow-effect"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(snapshotMarkdown)
                      toast({ variant: 'success', title: 'Copied', description: 'Snapshot copied.' })
                    } catch {
                      toast({ variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' })
                    }
                  }}
                >
                  Copy
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  Print
                </Button>
              </div>
            </>
          ) : !snapshotLoading ? (
            <div className="text-xs text-muted-foreground">No snapshot available.</div>
          ) : null}
          <div className="text-xs text-muted-foreground">
            Snapshot output is metadata-first and does not include protected message bodies.
          </div>
        </div>
      </MobileActionSheet>
    </div>
  )
}

