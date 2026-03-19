'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

type Health = {
  workspaceId: string
  mappedAccounts: number
  verifiedAccountMappings: number
  opportunityMappings: number
  observations: number
  needsReviewMappings: number
  ambiguousMappings: number
  staleMappings: number
  note: string
  computedAt: string
}

type Envelope =
  | { ok: true; data: { configured?: boolean; reason?: string; workspaceId: string | null; health: Health | null } }
  | { ok: false; error?: { message?: string } }

export function CrmSyncHealthCard() {
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState<Health | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations/crm/linkage-health', { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        setHealth(null)
        return
      }
      setHealth(json.data.health ?? null)
      if (typeof json.data.workspaceId === 'string' && json.data.workspaceId) {
        track('crm_linkage_health_viewed', { workspaceId: json.data.workspaceId })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">CRM linkage health</CardTitle>
          <Badge variant="outline">{health ? `${health.mappedAccounts} mapped` : 'Unavailable'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {loading ? <div>Loading…</div> : null}
        {!loading && !health ? (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            CRM linkage health is unavailable. Enable Revenue intelligence in workspace policies.
          </div>
        ) : null}
        {!loading && health ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">verified {health.verifiedAccountMappings}</Badge>
              <Badge variant="outline">opps {health.opportunityMappings}</Badge>
              <Badge variant="outline">observations {health.observations}</Badge>
              {health.needsReviewMappings > 0 ? <Badge variant="outline">needs review {health.needsReviewMappings}</Badge> : null}
              {health.ambiguousMappings > 0 ? <Badge variant="outline">ambiguous {health.ambiguousMappings}</Badge> : null}
              {health.staleMappings > 0 ? <Badge variant="outline">stale {health.staleMappings}</Badge> : null}
            </div>
            <div className="text-xs text-muted-foreground">{health.note}</div>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

