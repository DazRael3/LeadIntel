'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'

type PoliciesEnvelope =
  | { success: true; data: { policies: { benchmarks?: { benchmarksEnabled?: boolean; crossWorkspaceInsightsEnabled?: boolean; priorPeriodEnabled?: boolean; viewerRoles?: WorkspaceRole[] } }; role: WorkspaceRole } }
  | { success: false; error?: { message?: string } }

function uniqRoles(r: WorkspaceRole[]): WorkspaceRole[] {
  const set = new Set<WorkspaceRole>()
  for (const x of r) set.add(x)
  return Array.from(set)
}

export function BenchmarksSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<WorkspaceRole>('rep')
  const [enabled, setEnabled] = useState(true)
  const [cross, setCross] = useState(false)
  const [prior, setPrior] = useState(true)
  const [viewerRoles, setViewerRoles] = useState<WorkspaceRole[]>(['owner', 'admin', 'manager'])

  const canEdit = useMemo(() => role === 'owner' || role === 'admin' || role === 'manager', [role])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workspace/policies', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as PoliciesEnvelope | null
      if (!res.ok || !json || json.success !== true) {
        throw new Error((json as { error?: { message?: string } } | null)?.error?.message ?? 'Failed to load policies')
      }
      const b = json.data.policies.benchmarks ?? {}
      setRole(json.data.role ?? 'rep')
      setEnabled(Boolean(b.benchmarksEnabled ?? true))
      setCross(Boolean(b.crossWorkspaceInsightsEnabled ?? false))
      setPrior(Boolean(b.priorPeriodEnabled ?? true))
      setViewerRoles(uniqRoles((b.viewerRoles ?? ['owner', 'admin', 'manager']).filter(Boolean) as WorkspaceRole[]))
      track('benchmark_settings_viewed', { surface: 'settings_benchmarks' })
    } catch (e) {
      toast({ variant: 'destructive', title: 'Settings unavailable', description: e instanceof Error ? e.message : 'Failed to load policies' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function save(next: { enabled: boolean; cross: boolean; prior: boolean; viewerRoles: WorkspaceRole[] }) {
    const res = await fetch('/api/workspace/policies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        benchmarks: {
          benchmarksEnabled: next.enabled,
          crossWorkspaceInsightsEnabled: next.cross,
          priorPeriodEnabled: next.prior,
          viewerRoles: uniqRoles(next.viewerRoles),
        },
      }),
    })
    const json = (await res.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null
    if (!res.ok || !json || json.success !== true) {
      toast({ variant: 'destructive', title: 'Save failed', description: json?.error?.message ?? 'Please try again.' })
      return
    }
    toast({ title: 'Saved.' })
    track('cross_workspace_insight_toggled', { enabled: next.cross })
    await load()
  }

  function toggleViewer(r: WorkspaceRole) {
    const next = viewerRoles.includes(r) ? viewerRoles.filter((x) => x !== r) : [...viewerRoles, r]
    setViewerRoles(next.length > 0 ? next : viewerRoles)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Benchmark governance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="text-muted-foreground">
            Benchmarks are privacy-safe and thresholded. Cross-workspace insights only appear when the cohort is large enough; otherwise we fall back to
            workspace-only and prior-period comparisons.
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">No cross-tenant account data</Badge>
            <Badge variant="outline">No messaging benchmarking</Badge>
            <Badge variant="outline">Cohort thresholds</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Controls</CardTitle>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Enable benchmarks</div>
              <div className="text-xs text-muted-foreground">Controls benchmark dashboards and peer-pattern insights.</div>
            </div>
            <input type="checkbox" checked={enabled} disabled={!canEdit} onChange={(e) => setEnabled(e.target.checked)} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Enable cross-workspace insights</div>
              <div className="text-xs text-muted-foreground">Shows anonymized norms when privacy thresholds are met.</div>
            </div>
            <input type="checkbox" checked={cross} disabled={!canEdit || !enabled} onChange={(e) => setCross(e.target.checked)} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Enable prior-period comparison</div>
              <div className="text-xs text-muted-foreground">Compares current period to your prior period (workspace-only).</div>
            </div>
            <input type="checkbox" checked={prior} disabled={!canEdit || !enabled} onChange={(e) => setPrior(e.target.checked)} />
          </div>

          <div className="space-y-2">
            <div>
              <div className="font-medium">Viewer roles</div>
              <div className="text-xs text-muted-foreground">Which roles can view benchmark surfaces.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['owner', 'admin', 'manager', 'rep', 'viewer'] as WorkspaceRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={!canEdit || !enabled}
                  onClick={() => toggleViewer(r)}
                  className={`rounded border px-2 py-1 text-xs ${
                    viewerRoles.includes(r) ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200' : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => save({ enabled, cross, prior, viewerRoles })}
              disabled={!canEdit || loading}
              className="w-full md:w-auto"
            >
              Save changes
            </Button>
            {!canEdit ? <div className="mt-2 text-xs text-muted-foreground">Only owner/admin/manager can change benchmark settings.</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

