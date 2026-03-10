'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'

type Role = 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'
const ALL_ROLES: Role[] = ['owner', 'admin', 'manager', 'rep', 'viewer']

type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived' | 'rolled_out' | 'reverted'

type Experiment = {
  id: string
  key: string
  name: string
  surface: string
  status: ExperimentStatus
  rolloutPercent: number
  unitType: 'user' | 'workspace' | 'session'
  primaryMetrics: string[]
  variants: Array<{ key: string; name: string; weight: number }>
  updatedAt: string
}

type PoliciesEnvelope =
  | { ok: true; data: { role: Role; workspace: { id: string; name: string }; policies: WorkspacePolicies; updatedAt: string } }
  | { ok: false; error?: { message?: string } }

type ExperimentsEnvelope =
  | { ok: true; data: { workspaceId: string; experiments: Experiment[] } }
  | { ok: false; error?: { message?: string } }

function toggleRole(list: Role[], role: Role): Role[] {
  return list.includes(role) ? list.filter((r) => r !== role) : [...list, role]
}

export function ExperimentsSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null)
  const [role, setRole] = useState<Role>('viewer')
  const [policies, setPolicies] = useState<WorkspacePolicies | null>(null)
  const [experiments, setExperiments] = useState<Experiment[]>([])

  const growth = policies?.growth
  const isPrivileged = role === 'owner' || role === 'admin' || role === 'manager'
  const canEdit = isPrivileged && Boolean(growth && growth.manageRoles.includes(role))

  const manageRoles = useMemo(() => (growth?.manageRoles ?? ['owner', 'admin']) as Role[], [growth?.manageRoles])
  const viewerRoles = useMemo(() => (growth?.viewerRoles ?? ['owner', 'admin', 'manager']) as Role[], [growth?.viewerRoles])
  const protectedSurfaces = useMemo(() => (growth?.protectedSurfaces ?? []) as string[], [growth?.protectedSurfaces])

  useEffect(() => {
    track('experiment_settings_viewed', { surface: 'settings_experiments' })
    void (async () => {
      setLoading(true)
      const [polRes, expRes] = await Promise.all([fetch('/api/workspace/policies', { cache: 'no-store' }), fetch('/api/experiments', { cache: 'no-store' })])
      const polJson = (await polRes.json().catch(() => null)) as PoliciesEnvelope | null
      const expJson = (await expRes.json().catch(() => null)) as ExperimentsEnvelope | null
      if (!polRes.ok || !polJson || polJson.ok !== true) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        setLoading(false)
        return
      }
      setWorkspace(polJson.data.workspace)
      setRole(polJson.data.role)
      setPolicies(polJson.data.policies)
      if (expRes.ok && expJson && expJson.ok === true) {
        setExperiments(expJson.data.experiments)
      }
      setLoading(false)
    })()
  }, [toast])

  async function saveGrowth(next: WorkspacePolicies['growth']) {
    if (!workspace || !policies) return
    setSaving(true)
    try {
      const res = await fetch('/api/workspace/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ growth: next }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Save failed', description: json?.error?.message ?? 'Please try again.' })
        return
      }
      toast({ variant: 'success', title: 'Saved', description: 'Experiment controls updated.' })
      setPolicies((p) => (p ? { ...p, growth: next } : p))
    } finally {
      setSaving(false)
    }
  }

  async function refreshExperiments() {
    const res = await fetch('/api/experiments', { cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as ExperimentsEnvelope | null
    if (!res.ok || !json || json.ok !== true) return
    setExperiments(json.data.experiments)
  }

  async function createQuickExperiment() {
    if (!workspace) return
    const key = 'dashboard_activation_copy_v1'
    setSaving(true)
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key,
          name: 'Activation checklist copy',
          hypothesis: 'Clearer activation copy reduces early confusion and increases checklist progression.',
          surface: 'dashboard_activation',
          rolloutPercent: 0,
          unitType: 'user',
          targeting: { roles: ['owner', 'admin', 'manager', 'rep'] },
          variants: [
            { key: 'control', name: 'Control', weight: 5000 },
            { key: 'direct', name: 'Direct copy', weight: 5000 },
          ],
          primaryMetrics: ['checklist_step_clicked'],
          secondaryMetrics: ['upgrade_clicked'],
          notes: 'Copy-only test. Does not change gating, entitlements, or actions.',
        }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Create failed', description: json?.error?.message ?? 'Please try again.' })
        return
      }
      toast({ variant: 'success', title: 'Created', description: `Draft experiment "${key}" created.` })
      await refreshExperiments()
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(exp: Experiment, status: ExperimentStatus) {
    if (!workspace) return
    setSaving(true)
    try {
      const res = await fetch(`/api/experiments/${exp.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Update failed', description: json?.error?.message ?? 'Please try again.' })
        return
      }
      toast({ variant: 'success', title: 'Updated', description: `Status set to ${status}.` })
      await refreshExperiments()
    } finally {
      setSaving(false)
    }
  }

  if (loading || !policies || !growth) {
    return (
      <div className="min-h-screen bg-background terminal-grid">
        <div className="container mx-auto px-6 py-8 text-muted-foreground">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="experiments-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Experiments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Safe rollouts and A/B testing for non-critical product surfaces. No pricing manipulation, no entitlement bypasses.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workspace ? workspace.name : 'Workspace'}</Badge>
            <Badge variant="outline">role {role}</Badge>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Governance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={growth.experimentsEnabled}
                disabled={!canEdit || saving}
                onChange={(e) => void saveGrowth({ ...growth, experimentsEnabled: e.target.checked })}
              />
              <span>Enable experimentation system</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={growth.exposureLoggingEnabled}
                disabled={!canEdit || saving || !growth.experimentsEnabled}
                onChange={(e) => void saveGrowth({ ...growth, exposureLoggingEnabled: e.target.checked })}
              />
              <span>Enable exposure logging (deduped per user)</span>
            </label>
            <div className="text-xs text-muted-foreground">
              Guardrails: experiments cannot run on protected surfaces (security, governance, entitlements, billing). Copy-only variants are preferred.
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Viewer roles</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALL_ROLES.map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={viewerRoles.includes(r) ? 'default' : 'outline'}
                    className={viewerRoles.includes(r) ? 'neon-border hover:glow-effect h-8 text-xs' : 'h-8 text-xs'}
                    disabled={!canEdit || saving}
                    onClick={() => void saveGrowth({ ...growth, viewerRoles: toggleRole(viewerRoles, r) })}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Manage roles</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALL_ROLES.map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={manageRoles.includes(r) ? 'default' : 'outline'}
                    className={manageRoles.includes(r) ? 'neon-border hover:glow-effect h-8 text-xs' : 'h-8 text-xs'}
                    disabled={!canEdit || saving}
                    onClick={() => void saveGrowth({ ...growth, manageRoles: toggleRole(manageRoles, r) })}
                  >
                    {r}
                  </Button>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Only manage roles can create/start/pause/roll out experiments.</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Protected surfaces</CardTitle>
              <Badge variant="outline">{protectedSurfaces.length} protected</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {protectedSurfaces.map((s) => (
                <div key={s} className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs">
                  <div className="font-semibold text-foreground">{s}</div>
                  <div className="mt-1 text-muted-foreground">Experiments are blocked on this surface.</div>
                </div>
              ))}
            </div>
            {!canEdit ? <div className="text-xs text-muted-foreground">Only authorized roles can edit these settings.</div> : null}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Experiments</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void refreshExperiments()}>
                  Refresh
                </Button>
                <Button size="sm" className="neon-border hover:glow-effect" disabled={!canEdit || saving} onClick={() => void createQuickExperiment()}>
                  Create starter draft
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {experiments.length === 0 ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-4 text-sm text-muted-foreground">
                No experiments yet. Create a draft to start a safe copy/layout test.
              </div>
            ) : (
              <div className="space-y-3">
                {experiments.map((e) => (
                  <div key={e.id} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{e.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          <span className="font-mono">{e.key}</span> · surface <span className="font-mono">{e.surface}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline">status {e.status}</Badge>
                          <Badge variant="outline">rollout {e.rolloutPercent}%</Badge>
                          <Badge variant="outline">unit {e.unitType}</Badge>
                          {e.primaryMetrics?.[0] ? <Badge variant="outline">primary {e.primaryMetrics[0]}</Badge> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {e.status !== 'running' ? (
                          <Button size="sm" className="neon-border hover:glow-effect" disabled={!canEdit || saving || !growth.experimentsEnabled} onClick={() => void setStatus(e, 'running')}>
                            Start
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={!canEdit || saving} onClick={() => void setStatus(e, 'paused')}>
                            Pause
                          </Button>
                        )}
                        <Button size="sm" variant="outline" disabled={!canEdit || saving} onClick={() => void setStatus(e, 'archived')}>
                          Archive
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground space-y-2">
              <div className="font-semibold text-foreground">Launch checklist (quick)</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Verify the surface is non-critical and has a stable fallback.</li>
                <li>Define at least one primary metric and one expected failure mode.</li>
                <li>Start at 0–10% rollout, then increase gradually.</li>
                <li>Never test entitlements, billing amounts, or permission checks.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

