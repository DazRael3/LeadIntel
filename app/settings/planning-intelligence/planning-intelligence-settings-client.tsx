'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'
import { track } from '@/lib/analytics'

type Role = 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'

type Envelope =
  | { ok: true; data: { role: Role; workspace: { id: string; name: string }; policies: WorkspacePolicies } }
  | { ok: false; error?: { message?: string } }

export function PlanningIntelligenceSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState<Role>('viewer')
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null)
  const [policies, setPolicies] = useState<WorkspacePolicies | null>(null)

  const isAdmin = role === 'owner' || role === 'admin' || role === 'manager'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workspace/policies', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      setRole(json.data.role)
      setWorkspace(json.data.workspace)
      setPolicies(json.data.policies)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    track('intelligence_settings_viewed', { surface: 'settings_planning_intelligence' })
    void load()
  }, [load])

  async function update(patch: Record<string, unknown>) {
    if (!isAdmin) return
    setSaving(true)
    try {
      const res = await fetch('/api/workspace/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        toast({ variant: 'destructive', title: 'Save failed', description: json?.error?.message ?? 'Please try again.' })
        return
      }
      toast({ title: 'Saved.' })
      await load()
      track('planning_policy_changed', { keys: Object.keys(patch) })
    } finally {
      setSaving(false)
    }
  }

  const plan = policies?.planning

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="planning-intelligence-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Planning intelligence</h1>
            <p className="mt-1 text-sm text-muted-foreground">Controls for account planning and pipeline influence surfaces.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workspace ? workspace.name : 'Workspace'}</Badge>
            <Badge variant="outline">role {role}</Badge>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Controls</CardTitle>
              <Badge variant="outline">workflow-oriented</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {loading || !plan ? (
              <div>Loading…</div>
            ) : (
              <>
                <div className="rounded border border-cyan-500/10 bg-background/40 p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-foreground font-medium">Planning intelligence surfaces</div>
                    <div className="text-xs text-muted-foreground">When off, planning/influence cards will not render.</div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!isAdmin || saving}
                      checked={plan.planningIntelligenceEnabled}
                      onChange={(e) => void update({ planning: { planningIntelligenceEnabled: e.target.checked } })}
                    />
                    <span>{plan.planningIntelligenceEnabled ? 'On' : 'Off'}</span>
                  </label>
                </div>

                <div className="rounded border border-cyan-500/10 bg-background/40 p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-foreground font-medium">Team influence summaries</div>
                    <div className="text-xs text-muted-foreground">Shows influence/readiness summaries on team planning boards.</div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!isAdmin || saving}
                      checked={plan.teamInfluenceSummariesEnabled}
                      onChange={(e) => void update({ planning: { teamInfluenceSummariesEnabled: e.target.checked } })}
                    />
                    <span>{plan.teamInfluenceSummariesEnabled ? 'On' : 'Off'}</span>
                  </label>
                </div>

                <div className="rounded border border-cyan-500/10 bg-background/40 p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-foreground font-medium">Outcome-informed adjustments</div>
                    <div className="text-xs text-muted-foreground">
                      Uses explicitly recorded outcomes to adjust influence/readiness labels (bounded). No attribution claims.
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!isAdmin || saving}
                      checked={plan.outcomeInformedPlanningEnabled}
                      onChange={(e) => void update({ planning: { outcomeInformedPlanningEnabled: e.target.checked } })}
                    />
                    <span>{plan.outcomeInformedPlanningEnabled ? 'On' : 'Off'}</span>
                  </label>
                </div>

                <div className="text-xs text-muted-foreground">
                  These are bounded workflow intelligence controls. They do not claim forecasting accuracy or revenue prediction.
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => (window.location.href = '/settings/workspace')}>
            Workspace policies
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/dashboard/planning')}>
            Planning board
          </Button>
        </div>
      </div>
    </div>
  )
}

