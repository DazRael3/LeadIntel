'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Role = 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'

type Envelope =
  | { ok: true; data: { role: Role; policies: { invite: { allowedDomains: string[] | null } } } }
  | { ok: false; error?: { message?: string } }

export function IdentitySettingsClient() {
  const { toast } = useToast()
  const [role, setRole] = useState<Role>('viewer')
  const [domains, setDomains] = useState<string[] | null>(null)

  useEffect(() => {
    track('identity_page_viewed', { surface: 'settings_identity' })
    void (async () => {
      const res = await fetch('/api/workspace/policies', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      setRole(json.data.role)
      setDomains(json.data.policies.invite.allowedDomains ?? null)
    })()
  }, [toast])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="identity-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Identity & access</h1>
            <p className="mt-1 text-sm text-muted-foreground">Truthful, inspectable posture for buyers who verify.</p>
          </div>
          <Badge variant="outline">role {role}</Badge>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Authentication today</CardTitle>
              <Badge variant="outline">Supabase</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>
              <span className="font-medium text-foreground">Method:</span> email/password sessions (Supabase Auth)
            </div>
            <div>
              <span className="font-medium text-foreground">Tenant isolation:</span> enforced by database RLS and workspace membership checks.
            </div>
            <div className="text-xs text-muted-foreground">
              This page does not claim SSO/SAML/SCIM unless implemented and enabled.
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invite policy</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>
              <span className="font-medium text-foreground">Allowed invite domains:</span>{' '}
              {domains && domains.length > 0 ? domains.join(', ') : 'No restrictions'}
            </div>
            <div className="text-xs text-muted-foreground">
              Configure this in <a className="text-cyan-400 hover:underline" href="/settings/workspace">Workspace controls</a>.
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Role model</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium text-foreground">Owner/Admin/Manager</span>: configure governance, integrations, templates, and reviews.
              </li>
              <li>
                <span className="font-medium text-foreground">Rep</span>: execute workflows, prepare handoffs, and participate in comments/reviews.
              </li>
              <li>
                <span className="font-medium text-foreground">Viewer</span>: read-only access to shared workspace surfaces (no privileged changes).
              </li>
            </ul>
            <div className="text-xs text-muted-foreground">
              For larger deployments, contact us to align on rollout requirements and current control scope.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => (window.location.href = '/trust')}>
                Trust Center
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = '/settings/team')}>
                Team settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

