'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import type { DeploymentReadiness } from '@/lib/services/deployment-readiness'

type Role = 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'

type Envelope =
  | { ok: true; data: { workspace: { id: string; name: string }; role: Role; readiness: DeploymentReadiness } }
  | { ok: false; error?: { message?: string } }

export function DeploymentSettingsClient() {
  const { toast } = useToast()
  const [role, setRole] = useState<Role>('viewer')
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null)
  const [readiness, setReadiness] = useState<DeploymentReadiness | null>(null)

  useEffect(() => {
    track('deployment_checklist_viewed', { surface: 'settings_deployment' })
    void (async () => {
      const res = await fetch('/api/workspace/deployment-readiness', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      setRole(json.data.role)
      setWorkspace(json.data.workspace)
      setReadiness(json.data.readiness)
    })()
  }, [toast])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="deployment-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Deployment checklist</h1>
            <p className="mt-1 text-sm text-muted-foreground">Derived from real workspace state (no fake completion %).</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workspace ? workspace.name : 'Workspace'}</Badge>
            <Badge variant="outline">role {role}</Badge>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Go-live readiness</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            {readiness ? (
              <div className="space-y-2">
                {readiness.items.map((it) => (
                  <div
                    key={it.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded border border-cyan-500/10 bg-background/40 p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-medium">{it.title}</span>
                        <Badge
                          variant="outline"
                          className={
                            it.status === 'ready'
                              ? 'border-green-500/30 text-green-300 bg-green-500/10'
                              : 'border-yellow-500/30 text-yellow-300 bg-yellow-500/10'
                          }
                        >
                          {it.status === 'ready' ? 'Ready' : 'Needs attention'}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{it.detail}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        track('deployment_checklist_item_clicked', { item: it.id, href: it.href })
                        window.location.href = it.href
                      }}
                    >
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Loading…</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

