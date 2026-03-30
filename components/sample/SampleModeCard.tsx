'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePlan } from '@/components/PlanProvider'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type SampleModeEnvelope =
  | {
      ok: true
      data: { enabledByTier: boolean; enabled: boolean; seededAt: string | null; seedVersion: number | null }
    }
  | { ok: false; error?: { message?: string } }

export function SampleModeCard() {
  const { capabilities, tier } = usePlan()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<SampleModeEnvelope | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sample-mode', { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as SampleModeEnvelope | null
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const model = useMemo(() => (data && data.ok === true ? data.data : null), [data])
  const allowed = capabilities.sample_workspace === true

  const canShow = allowed && tier === 'starter'
  if (!canShow) return null

  async function post(action: 'enable' | 'reset' | 'disable') {
    setSaving(true)
    try {
      const res = await fetch('/api/sample-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const ok = res.ok
      const json = (await res.json().catch(() => null)) as unknown
      if (!ok) {
        toast({ title: 'Sample mode failed', description: 'Unable to apply sample mode action. Please try again.' })
        track('sample_mode_action_failed', { action, tier })
        return
      }
      track('sample_mode_action_succeeded', { action, tier })
      if (action === 'disable') {
        toast({ title: 'Sample mode disabled', description: 'Sample data has been removed from your workspace.' })
      } else if (action === 'reset') {
        toast({ title: 'Sample workspace reset', description: 'Sample data was reseeded so you can rerun the flow.' })
      } else {
        toast({ title: 'Sample workspace enabled', description: 'Sample accounts and signals were added to your workspace.' })
      }
      void json
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50" data-testid="sample-mode-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Proof & Sample Mode</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              Try the workflow with clearly labeled sample data. Nothing here is real customer activity.
            </div>
          </div>
          <Badge variant="outline">Starter</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {loading && !model ? (
          <div>Loading sample mode…</div>
        ) : (
          <div className="space-y-2">
            <div>
              Status:{' '}
              <span className={model?.enabled ? 'text-green-400' : 'text-muted-foreground'}>
                {model?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {model?.seededAt ? <div className="text-xs">Seeded: {new Date(model.seededAt).toLocaleString()}</div> : null}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {!model?.enabled ? (
            <Button className="neon-border hover:glow-effect" size="sm" onClick={() => void post('enable')} disabled={saving}>
              Enable sample workspace
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => void post('reset')} disabled={saving}>
                Reset & reseed
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void post('disable')} disabled={saving}>
                Disable
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={saving || loading}>
            Refresh
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Tip: after enabling, open the Lead Library and Trigger Events to inspect the seeded sample accounts and signals.
        </div>
      </CardContent>
    </Card>
  )
}

