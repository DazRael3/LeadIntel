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

export function AssistantSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null)
  const [role, setRole] = useState<Role>('viewer')
  const [policies, setPolicies] = useState<WorkspacePolicies | null>(null)

  const isPrivileged = role === 'owner' || role === 'admin' || role === 'manager'
  const canEdit = isPrivileged

  useEffect(() => {
    track('assistant_settings_viewed', { surface: 'settings_assistant' })
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

  const assistant = policies?.assistant
  const viewerRoles = useMemo(() => (assistant?.assistantViewerRoles ?? ['owner', 'admin', 'manager', 'rep']) as Role[], [assistant?.assistantViewerRoles])
  const actionRoles = useMemo(() => (assistant?.assistantActionRoles ?? ['owner', 'admin', 'manager']) as Role[], [assistant?.assistantActionRoles])

  async function save(next: WorkspacePolicies['assistant']) {
    if (!workspace || !policies) return
    setSaving(true)
    try {
      const res = await fetch('/api/workspace/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assistant: next }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Save failed', description: json?.error?.message ?? 'Please try again.' })
        return
      }
      toast({ variant: 'success', title: 'Saved', description: 'Assistant controls updated.' })
      setPolicies((p) => (p ? { ...p, assistant: next } : p))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !policies || !assistant) {
    return (
      <div className="min-h-screen bg-background terminal-grid">
        <div className="container mx-auto px-6 py-8 text-muted-foreground">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="assistant-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Assistant</h1>
            <p className="mt-1 text-sm text-muted-foreground">Conversational workflow layer (grounded, permission-aware, non-autonomous).</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workspace ? workspace.name : 'Workspace'}</Badge>
            <Badge variant="outline">role {role}</Badge>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Enablement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={assistant.assistantEnabled} disabled={!canEdit || saving} onChange={(e) => void save({ ...assistant, assistantEnabled: e.target.checked })} />
              <span>Enable assistant</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={assistant.proactiveNudgesEnabled}
                disabled={!canEdit || saving || !assistant.assistantEnabled}
                onChange={(e) => void save({ ...assistant, proactiveNudgesEnabled: e.target.checked })}
              />
              <span>Enable proactive nudges (bounded)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={assistant.assistantActionsEnabled}
                disabled={!canEdit || saving || !assistant.assistantEnabled}
                onChange={(e) => void save({ ...assistant, assistantActionsEnabled: e.target.checked })}
              />
              <span>Enable assistant actions (requires explicit confirmation)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={assistant.assistantThreadsEnabled}
                disabled={!canEdit || saving || !assistant.assistantEnabled}
                onChange={(e) => void save({ ...assistant, assistantThreadsEnabled: e.target.checked })}
              />
              <span>Enable assistant threads (object-attached conversations)</span>
            </label>
            <div className="text-xs text-muted-foreground">
              The assistant cannot send outreach automatically and cannot bypass role/plan gating. It proposes actions and requires a user confirmation click to execute.
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Who can use the assistant</CardTitle>
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
                    onClick={() => void save({ ...assistant, assistantViewerRoles: toggleRole(viewerRoles, r) })}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Action roles</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALL_ROLES.map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={actionRoles.includes(r) ? 'default' : 'outline'}
                    className={actionRoles.includes(r) ? 'neon-border hover:glow-effect h-8 text-xs' : 'h-8 text-xs'}
                    disabled={!canEdit || saving}
                    onClick={() => void save({ ...assistant, assistantActionRoles: toggleRole(actionRoles, r) })}
                  >
                    {r}
                  </Button>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">These roles can execute assistant-suggested actions after explicit confirmation.</div>
            </div>
          </CardContent>
        </Card>

        {!isPrivileged ? <div className="text-xs text-muted-foreground">Only owner/admin/manager can update assistant controls.</div> : null}
      </div>
    </div>
  )
}

