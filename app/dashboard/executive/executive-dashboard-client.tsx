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

type Envelope =
  | { ok: true; data: { workspace: { id: string; name: string }; role: string; summary: ExecutiveSummary } }
  | { ok: false; error?: { message?: string } }

export function ExecutiveDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('Workspace')
  const [role, setRole] = useState('viewer')
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null)

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
    </div>
  )
}

