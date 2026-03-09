'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Role = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'

type Policies = {
  revenueIntelligence?: {
    revenueIntelligenceEnabled?: boolean
    attributionSupportEnabled?: boolean
    verificationWorkflowsEnabled?: boolean
    ambiguousVisibleToViewerRoles?: boolean
    defaultLinkageWindowDays?: number
  }
}

type Envelope =
  | { ok: true; data: { workspace: { id: string; name: string }; role: Role; policies: Policies; updatedAt: string | null } }
  | { ok: false; error?: { message?: string } }

export function RevenueIntelligenceSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [role, setRole] = useState<Role>('member')
  const [policies, setPolicies] = useState<Policies>({})
  const [saving, setSaving] = useState(false)

  const isAdmin = role === 'owner' || role === 'admin' || role === 'manager'

  const ri = policies.revenueIntelligence ?? {}
  const enabled = Boolean(ri.revenueIntelligenceEnabled)

  const canEdit = isAdmin

  const derivedWindow = useMemo(() => {
    const n = ri.defaultLinkageWindowDays
    return typeof n === 'number' && Number.isFinite(n) ? n : 30
  }, [ri.defaultLinkageWindowDays])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workspace/policies', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      setWorkspaceId(json.data.workspace.id)
      setRole(json.data.role)
      setPolicies(json.data.policies ?? {})
      track('revenue_intelligence_settings_viewed', { workspaceId: json.data.workspace.id })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function savePatch(patch: Policies) {
    if (!canEdit) return
    setSaving(true)
    try {
      const res = await fetch('/api/workspace/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
        return
      }
      toast({ variant: 'success', title: 'Saved.' })
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="revenue-intelligence-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Revenue intelligence</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Closed-loop CRM linkage is explicit and bounded. It does not claim pipeline attribution.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {workspaceId ? <Badge variant="outline">{workspaceId.slice(0, 8)}…</Badge> : null}
            <Badge variant="outline">{role}</Badge>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {loading ? <div>Loading…</div> : null}
            {!loading ? (
              <>
                <ToggleRow
                  label="Enable revenue intelligence"
                  description="Turns on CRM linkage context, workflow→outcome linkage, and verification surfaces."
                  value={enabled}
                  disabled={!canEdit || saving}
                  onChange={(v) =>
                    void savePatch({
                      revenueIntelligence: {
                        ...ri,
                        revenueIntelligenceEnabled: v,
                      },
                    })
                  }
                />
                <ToggleRow
                  label="Enable attribution support summaries"
                  description="Shows bounded support labels (verified/plausible/ambiguous) without claiming causality."
                  value={Boolean(ri.attributionSupportEnabled)}
                  disabled={!canEdit || saving || !enabled}
                  onChange={(v) =>
                    void savePatch({
                      revenueIntelligence: {
                        ...ri,
                        attributionSupportEnabled: v,
                      },
                    })
                  }
                />
                <ToggleRow
                  label="Enable verification workflows"
                  description="Allows managers/admins to verify or mark ambiguous linkages."
                  value={Boolean(ri.verificationWorkflowsEnabled)}
                  disabled={!canEdit || saving || !enabled}
                  onChange={(v) =>
                    void savePatch({
                      revenueIntelligence: {
                        ...ri,
                        verificationWorkflowsEnabled: v,
                      },
                    })
                  }
                />
                <ToggleRow
                  label="Show ambiguous linkages to all viewers"
                  description="If disabled, ambiguous cases should be handled by verifiers; cards still avoid overclaiming."
                  value={Boolean(ri.ambiguousVisibleToViewerRoles)}
                  disabled={!canEdit || saving || !enabled}
                  onChange={(v) =>
                    void savePatch({
                      revenueIntelligence: {
                        ...ri,
                        ambiguousVisibleToViewerRoles: v,
                      },
                    })
                  }
                />

                <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Default linkage window</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {([7, 30, 90] as const).map((d) => (
                      <Button
                        key={d}
                        size="sm"
                        variant={derivedWindow === d ? 'default' : 'outline'}
                        onClick={() =>
                          void savePatch({
                            revenueIntelligence: {
                              ...ri,
                              defaultLinkageWindowDays: d,
                            },
                          })
                        }
                        disabled={!canEdit || saving || !enabled}
                      >
                        {d}d
                      </Button>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    This window affects account linkage summaries. It does not change source-of-record CRM data.
                  </div>
                </div>

                {!canEdit ? <div className="text-xs text-muted-foreground">Only owners/admins/managers can edit these controls.</div> : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ToggleRow(props: { label: string; description: string; value: boolean; disabled: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded border border-cyan-500/10 bg-background/40 p-3">
      <div>
        <div className="text-sm font-semibold text-foreground">{props.label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{props.description}</div>
      </div>
      <button
        type="button"
        className={`h-8 w-14 rounded-full border transition ${
          props.value ? 'bg-cyan-500/20 border-cyan-500/30' : 'bg-background/40 border-cyan-500/10'
        } ${props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-pressed={props.value}
        onClick={() => {
          if (props.disabled) return
          props.onChange(!props.value)
        }}
      >
        <span
          className={`block h-6 w-6 rounded-full bg-foreground/80 transition-transform ${
            props.value ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

