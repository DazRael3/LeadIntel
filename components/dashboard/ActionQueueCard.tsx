'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActionQueueTable, type ActionQueueRow } from '@/components/dashboard/ActionQueueTable'
import { track } from '@/lib/analytics'

type Envelope =
  | { ok: true; data: { items: ActionQueueRow[] } }
  | { ok: false; error?: { message?: string } }

export function ActionQueueCard() {
  const [items, setItems] = useState<ActionQueueRow[]>([])
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/workspace/actions/queue?status=ready&limit=5', { cache: 'no-store' })
      if (res.status === 403) {
        if (!cancelled) setHidden(true)
        return
      }
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (cancelled) return
      if (!res.ok || !json || json.ok !== true) return
      setItems(json.data.items ?? [])
      track('action_queue_viewed', { surface: 'dashboard_card', count: (json.data.items ?? []).length })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (hidden) return null

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Action queue</CardTitle>
          <Badge variant="outline">{items.length} ready</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground">No ready actions yet. Prepare a handoff to populate your workspace queue.</div>
        ) : (
          <ActionQueueTable items={items} />
        )}
      </CardContent>
    </Card>
  )
}

