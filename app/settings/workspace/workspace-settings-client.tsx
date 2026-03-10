'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'
import { defaultWorkspacePolicies } from '@/lib/domain/workspace-policies'
import { track } from '@/lib/analytics'

type Role = 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'

type Envelope =
  | { ok: true; data: { workspace: { id: string; name: string }; role: Role; policies: WorkspacePolicies; updatedAt: string | null } }
  | { ok: false; error?: { message?: string } }

function rolesLabel(roles: string[]): string {
  return roles.map((r) => r.replace(/^./, (c) => c.toUpperCase())).join(', ')
}

export function WorkspaceSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState<Role>('viewer')
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null)
  const [policies, setPolicies] = useState<WorkspacePolicies>(defaultWorkspacePolicies())

  const isAdmin = role === 'owner' || role === 'admin' || role === 'manager'

  const allowedDomainsText = useMemo(() => (policies.invite.allowedDomains ?? []).join(', '), [policies.invite.allowedDomains])
  const [domainsDraft, setDomainsDraft] = useState('')
  const [requireApproval, setRequireApproval] = useState(false)
  const [exportsRolesDraft, setExportsRolesDraft] = useState<string>('owner, admin')

  const refresh = useCallback(async () => {
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
      setDomainsDraft((json.data.policies.invite.allowedDomains ?? []).join(', '))
      setRequireApproval(Boolean(json.data.policies.handoffs.requireApproval))
      setExportsRolesDraft((json.data.policies.exports.allowedRoles ?? []).join(', '))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    track('workspace_controls_viewed', { surface: 'settings_workspace' })
    void refresh()
  }, [refresh])

  async function savePolicyPatch(patch: Record<string, unknown>) {
    if (!isAdmin) return
    setSaving(true)
    try {
      const res = await fetch('/api/workspace/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Save failed', description: json && 'error' in json ? json.error?.message : 'Please try again.' })
        return
      }
      toast({ title: 'Saved.' })
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="workspace-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Workspace controls</h1>
            <p className="mt-1 text-sm text-muted-foreground">Governance settings that are actually enforced server-side.</p>
          </div>
          <Badge variant="outline">{workspace ? workspace.name : 'Workspace'}</Badge>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Invite policy</CardTitle>
              <Badge variant="outline">Identity readiness</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="text-xs text-muted-foreground">
              Optional allowlist for who can be invited. If empty, invites are not domain-restricted.
            </div>
            <Input
              value={domainsDraft}
              onChange={(e) => setDomainsDraft(e.target.value)}
              placeholder="example.com, subsidiary.com"
              disabled={!isAdmin || saving || loading}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                Current: {policies.invite.allowedDomains && policies.invite.allowedDomains.length > 0 ? allowedDomainsText : 'No restrictions'}
              </div>
              <Button
                size="sm"
                className="neon-border hover:glow-effect"
                disabled={!isAdmin || saving || loading}
                onClick={() => void savePolicyPatch({ invite: { allowedDomains: domainsDraft.split(',') } })}
              >
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Workflow governance</CardTitle>
              <Badge variant="outline">Action layer</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-3 rounded border border-cyan-500/10 bg-background/40 p-3">
              <div>
                <div className="text-foreground font-medium">Require approval before handoff delivery</div>
                <div className="text-xs text-muted-foreground">
                  When enabled, handoff delivery is blocked until a manager/admin approves the queued item.
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  disabled={!isAdmin || saving || loading}
                  onChange={(e) => {
                    const next = e.target.checked
                    setRequireApproval(next)
                    void savePolicyPatch({ handoffs: { requireApproval: next } })
                  }}
                />
                <span>{requireApproval ? 'On' : 'Off'}</span>
              </label>
            </div>

            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-foreground font-medium">Export permissions</div>
              <div className="text-xs text-muted-foreground">Roles allowed to create exports.</div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                <Input
                  value={exportsRolesDraft}
                  onChange={(e) => setExportsRolesDraft(e.target.value)}
                  disabled={!isAdmin || saving || loading}
                  placeholder="owner, admin"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isAdmin || saving || loading}
                  onClick={() =>
                    void savePolicyPatch({
                      exports: {
                        allowedRoles: exportsRolesDraft
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                >
                  Save roles
                </Button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Current: {rolesLabel(policies.exports.allowedRoles)}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              These policies only show options that are actually enforced in the app. No fake “enterprise” toggles.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

