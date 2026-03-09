'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'

type Role = 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'

type PoliciesEnvelope =
  | { ok: true; data: { role: Role; workspace: { id: string; name: string }; policies: WorkspacePolicies } }
  | { ok: false; error?: { message?: string } }

type AuditRow = {
  id: string
  action: string
  target_type: string
  target_id: string | null
  created_at: string
  actor_user_id: string
  meta: Record<string, unknown>
}

type AuditEnvelope = { ok: true; data: { rows: AuditRow[]; hasMore: boolean } } | { ok: false; error?: { message?: string } }

function safeIso(ts: string): string {
  const d = new Date(ts)
  if (!Number.isFinite(d.getTime())) return ts
  return d.toLocaleString()
}

export function GovernanceSettingsClient() {
  const { toast } = useToast()
  const [role, setRole] = useState<Role>('viewer')
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null)
  const [policies, setPolicies] = useState<WorkspacePolicies | null>(null)
  const [auditRows, setAuditRows] = useState<AuditRow[]>([])

  const isPrivileged = role === 'owner' || role === 'admin' || role === 'manager'

  useEffect(() => {
    track('governance_page_viewed', { surface: 'settings_governance' })
    void (async () => {
      const res = await fetch('/api/workspace/policies', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as PoliciesEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      setRole(json.data.role)
      setWorkspace(json.data.workspace)
      setPolicies(json.data.policies)
    })()
  }, [toast])

  useEffect(() => {
    if (!isPrivileged) return
    void (async () => {
      // Reuse team audit endpoint which already sanitizes output.
      const res = await fetch('/api/team/audit?page=1&pageSize=25', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as AuditEnvelope | null
      if (!res.ok || !json || json.ok !== true) return
      setAuditRows(json.data.rows ?? [])
    })()
  }, [isPrivileged])

  const auditCoverage = useMemo(() => {
    // This is a truthful “coverage map” based on known audit actions in the repo.
    return [
      { area: 'Policy changes', actions: ['workspace.policy_updated', 'template_set.default_changed'] },
      { area: 'Members & invites', actions: ['member.invited', 'invite.accepted', 'member.role_changed', 'member.removed', 'invite.denied_by_policy'] },
      { area: 'Templates & approvals', actions: ['template.created', 'template.updated', 'template.approved'] },
      { area: 'Webhooks', actions: ['webhook.secret_rotated', 'webhook.test_sent'] },
      { area: 'Actions & delivery', actions: ['handoff.*', 'export.*', 'action_queue.*'] },
      { area: 'Recipes', actions: ['action_recipe.created', 'action_recipe.updated'] },
    ]
  }, [])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="governance-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Governance</h1>
            <p className="mt-1 text-sm text-muted-foreground">Admin surfaces for access review and audit visibility.</p>
          </div>
          <Badge variant="outline">{workspace ? workspace.name : 'Workspace'}</Badge>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Access review</CardTitle>
              <Badge variant="outline">role {role}</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>
              <span className="font-medium text-foreground">Who can manage governance:</span> owner, admin, manager
            </div>
            <div className="text-xs text-muted-foreground">
              Review members, roles, and privileged surfaces on the Team page.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => (window.location.href = '/settings/team')}>
                Open team members
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = '/settings/workspace')}>
                Open workspace controls
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = '/settings/integrations')}>
                Open integrations
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active policies</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            {policies ? (
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-medium text-foreground">Invite domains:</span>{' '}
                  {policies.invite.allowedDomains && policies.invite.allowedDomains.length > 0 ? policies.invite.allowedDomains.join(', ') : 'No restrictions'}
                </li>
                <li>
                  <span className="font-medium text-foreground">Handoff approval requirement:</span>{' '}
                  {policies.handoffs.requireApproval ? 'Enabled' : 'Not required'}
                </li>
                <li>
                  <span className="font-medium text-foreground">Export roles:</span> {policies.exports.allowedRoles.join(', ')}
                </li>
              </ul>
            ) : (
              <div className="text-xs text-muted-foreground">Loading…</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Audit coverage</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="overflow-hidden rounded border border-cyan-500/10">
              <table className="w-full text-xs">
                <thead className="bg-background/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Area</th>
                    <th className="px-3 py-2 text-left">Examples</th>
                  </tr>
                </thead>
                <tbody>
                  {auditCoverage.map((r) => (
                    <tr key={r.area} className="border-t border-cyan-500/10">
                      <td className="px-3 py-2 text-foreground">{r.area}</td>
                      <td className="px-3 py-2">{r.actions.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              This is a mapping of events the product records today—not a certification checklist.
            </div>
          </CardContent>
        </Card>

        {isPrivileged ? (
          <Card className="border-cyan-500/20 bg-card/50">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Recent governance changes</CardTitle>
                <Button size="sm" variant="outline" onClick={() => (window.location.href = '/settings/audit')}>
                  Open full audit log
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {auditRows.length === 0 ? (
                <div className="text-xs text-muted-foreground">No audit entries yet.</div>
              ) : (
                <div className="overflow-hidden rounded border border-cyan-500/10">
                  <table className="w-full text-xs">
                    <thead className="bg-background/60 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">When</th>
                        <th className="px-3 py-2 text-left">Action</th>
                        <th className="px-3 py-2 text-left">Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.slice(0, 20).map((r) => (
                        <tr key={r.id} className="border-t border-cyan-500/10">
                          <td className="px-3 py-2">{safeIso(r.created_at)}</td>
                          <td className="px-3 py-2 text-foreground">{r.action}</td>
                          <td className="px-3 py-2">{r.target_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

