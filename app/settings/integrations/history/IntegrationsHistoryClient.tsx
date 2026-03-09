'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { DeliveryHistoryRow } from '@/lib/services/delivery-history'
import { DeliveryHistoryTable } from '@/components/settings/DeliveryHistoryTable'
import { track } from '@/lib/analytics'

type Envelope =
  | { ok: true; data: { history: DeliveryHistoryRow[] } }
  | { ok: false; error?: { message?: string } }

export function IntegrationsHistoryClient() {
  const { toast } = useToast()
  const [history, setHistory] = useState<DeliveryHistoryRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/workspace/actions/delivery-history?limit=100', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Load failed', description: json && 'error' in json ? json.error?.message : 'Please try again.' })
        return
      }
      setHistory(json.data.history ?? [])
      track('delivery_history_viewed', { count: (json.data.history ?? []).length })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="integrations-history-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Delivery history</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sanitized delivery activity across webhook/export destinations.</p>
          </div>
          <Badge variant="outline">{history.length} rows</Badge>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Recent activity</CardTitle>
              <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>{loading ? <div className="text-sm text-muted-foreground">Loading…</div> : <DeliveryHistoryTable history={history} />}</CardContent>
        </Card>
      </div>
    </div>
  )
}

