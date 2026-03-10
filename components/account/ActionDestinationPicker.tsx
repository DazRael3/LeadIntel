'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type SummaryEnvelope =
  | { ok: true; data: { defaults: { handoffWebhookEndpointId: string | null } } }
  | { ok: false; error?: { message?: string } }

export function ActionDestinationPicker() {
  const [defaultId, setDefaultId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/workspace/integrations/summary', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as SummaryEnvelope | null
        if (cancelled) return
        if (!res.ok || !json || json.ok !== true) {
          setDefaultId(null)
          return
        }
        setDefaultId(json.data.defaults.handoffWebhookEndpointId ?? null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-cyan-500/10 bg-background/40 p-3">
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Destination</div>
        <div className="text-xs text-muted-foreground">
          {loading ? 'Checking…' : defaultId ? 'Default handoff webhook is set.' : 'No default handoff destination yet.'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{defaultId ? 'Ready' : 'Setup needed'}</Badge>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => (window.location.href = '/settings/integrations')}>
          Configure
        </Button>
      </div>
    </div>
  )
}

