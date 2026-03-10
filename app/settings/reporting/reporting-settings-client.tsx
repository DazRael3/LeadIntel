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

type Envelope =
  | { ok: true; data: { role: Role; workspace: { id: string; name: string }; policies: WorkspacePolicies; updatedAt: string } }
  | { ok: false; error?: { message?: string } }

function toggleRole(list: Role[], role: Role): Role[] {
  return list.includes(role) ? list.filter((r) => r !== role) : [...list, role]
}

export function ReportingSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null)
  const [role, setRole] = useState<Role>('viewer')
  const [policies, setPolicies] = useState<WorkspacePolicies | null>(null)

  const isPrivileged = role === 'owner' || role === 'admin' || role === 'manager'

  useEffect(() => {
    track('reporting_settings_viewed', { surface: 'settings_reporting' })
    void (async () => {
      setLoading(true)
      const res = await fetch('/api/workspace/policies', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        setLoading(false)
        return
      }
      setWorkspace(json.data.workspace)
      setRole(json.data.role)
      setPolicies(json.data.policies)
      setLoading(false)
    })()
  }, [toast])

  const canEdit = isPrivileged

  const reporting = policies?.reporting
  const execRoles = useMemo(() => (reporting?.executiveViewerRoles ?? ['owner', 'admin', 'manager']) as Role[], [reporting?.executiveViewerRoles])
  const commandRoles = useMemo(() => (reporting?.commandViewerRoles ?? ['owner', 'admin', 'manager']) as Role[], [reporting?.commandViewerRoles])

  async function save(next: WorkspacePolicies['reporting']) {
    if (!workspace || !policies) return
    setSaving(true)
    try {
      const res = await fetch('/api/workspace/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reporting: next }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { policies?: WorkspacePolicies }; error?: { message?: string } } | null
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Save failed', description: json?.error?.message ?? 'Please try again.' })
        return
      }
      toast({ variant: 'success', title: 'Saved', description: 'Reporting controls updated.' })
      setPolicies((p) => (p ? { ...p, reporting: next } : p))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !policies || !reporting) {
    return (
      <div className="min-h-screen bg-background terminal-grid">
        <div className="container mx-auto px-6 py-8 text-muted-foreground">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="reporting-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Reporting</h1>
            <p className="mt-1 text-sm text-muted-foreground">Controls for executive summaries and command-center mode.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workspace ? workspace.name : 'Workspace'}</Badge>
            <Badge variant="outline">role {role}</Badge>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Executive surfaces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reporting.executiveEnabled}
                disabled={!canEdit || saving}
                onChange={(e) => void save({ ...reporting, executiveEnabled: e.target.checked })}
              />
              <span>Enable executive dashboard</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reporting.snapshotsEnabled}
                disabled={!canEdit || saving || !reporting.executiveEnabled}
                onChange={(e) => void save({ ...reporting, snapshotsEnabled: e.target.checked })}
              />
              <span>Enable executive snapshots (copy/print)</span>
            </label>

            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Who can view</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALL_ROLES.map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={execRoles.includes(r) ? 'default' : 'outline'}
                    className={execRoles.includes(r) ? 'neon-border hover:glow-effect h-8 text-xs' : 'h-8 text-xs'}
                    disabled={!canEdit || saving}
                    onClick={() => void save({ ...reporting, executiveViewerRoles: toggleRole(execRoles, r) })}
                  >
                    {r}
                  </Button>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Keep this scoped. Executive surfaces are metadata-first and not real-time.</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Command Center</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reporting.commandCenterEnabled}
                disabled={!canEdit || saving}
                onChange={(e) => void save({ ...reporting, commandCenterEnabled: e.target.checked })}
              />
              <span>Enable Command Center mode</span>
            </label>

            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Who can view</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALL_ROLES.map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={commandRoles.includes(r) ? 'default' : 'outline'}
                    className={commandRoles.includes(r) ? 'neon-border hover:glow-effect h-8 text-xs' : 'h-8 text-xs'}
                    disabled={!canEdit || saving}
                    onClick={() => void save({ ...reporting, commandViewerRoles: toggleRole(commandRoles, r) })}
                  >
                    {r}
                  </Button>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Command Center is a daily operating view built from queue + approvals. No “live wallboard” claims.</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mobile quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reporting.mobileQuickActionsEnabled}
                disabled={!canEdit || saving}
                onChange={(e) => void save({ ...reporting, mobileQuickActionsEnabled: e.target.checked })}
              />
              <span>Enable quick-copy and compact action sheets on mobile</span>
            </label>
            <div className="text-xs text-muted-foreground">
              This controls mobile convenience interactions only. Server-side permissions still govern anything stateful or privileged.
            </div>
          </CardContent>
        </Card>

        {!isPrivileged ? (
          <div className="text-xs text-muted-foreground">Only owner/admin/manager can update reporting controls.</div>
        ) : null}
      </div>
    </div>
  )
}

