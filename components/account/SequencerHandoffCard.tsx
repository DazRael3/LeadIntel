'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import { HandoffPreviewDrawer } from '@/components/account/HandoffPreviewDrawer'

type Envelope =
  | { ok: true; data: { queueItemId: string; canDeliver: boolean; payloadPreview: Record<string, unknown> } }
  | { ok: false; error?: { message?: string } }

export function SequencerHandoffCard(props: { accountId: string; window: '7d' | '30d' | '90d' | 'all' }) {
  const { toast } = useToast()
  const [preparing, setPreparing] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [queueItemId, setQueueItemId] = useState<string | null>(null)
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null)
  const [canDeliver, setCanDeliver] = useState(false)
  const [delivering, setDelivering] = useState(false)

  async function prepare() {
    setPreparing(true)
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/actions/sequence`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ window: props.window }),
      })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        if (res.status === 403) {
          toast({ variant: 'destructive', title: 'Team feature', description: 'Sequencer handoff requires the Team plan.' })
          window.location.href = '/pricing?target=team'
          return
        }
        toast({ variant: 'destructive', title: 'Prepare failed', description: json && 'error' in json ? json.error?.message : 'Please try again.' })
        return
      }
      setQueueItemId(json.data.queueItemId)
      setPayload(json.data.payloadPreview ?? null)
      setCanDeliver(Boolean(json.data.canDeliver))
      setDrawerOpen(true)
      toast({ variant: 'success', title: 'Prepared', description: 'Sequencer package added to your workspace queue.' })
      track('sequencer_handoff_prepared', { accountId: props.accountId, queueItemId: json.data.queueItemId })
    } finally {
      setPreparing(false)
    }
  }

  async function deliver() {
    if (!queueItemId) return
    setDelivering(true)
    try {
      const res = await fetch(`/api/workspace/actions/queue/${encodeURIComponent(queueItemId)}/deliver`, { method: 'POST' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Delivery failed', description: json && 'error' in json ? json.error?.message : 'Please try again.' })
        return
      }
      toast({ variant: 'success', title: 'Queued', description: 'Webhook delivery queued.' })
      track('sequencer_handoff_delivered', { accountId: props.accountId, queueItemId })
      setDrawerOpen(false)
    } finally {
      setDelivering(false)
    }
  }

  return (
    <>
      <Card className="border-cyan-500/20 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Sequencer handoff</CardTitle>
            <Badge variant="outline">Via webhook/export</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="text-xs text-muted-foreground">
            Prepare a sequence-ready package: suggested sequence name, target persona, opener, follow-up angle, and a rep note. Deliver via your configured destination.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="neon-border hover:glow-effect h-7 text-xs" disabled={preparing} onClick={() => void prepare()}>
              {preparing ? 'Preparing…' : 'Prepare sequencer package'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <HandoffPreviewDrawer
        open={drawerOpen}
        title="Sequencer package preview"
        subtitle="Handoff package only. LeadIntel does not send sequences."
        payload={payload}
        canDeliver={canDeliver}
        delivering={delivering}
        onClose={() => setDrawerOpen(false)}
        onDeliver={() => void deliver()}
      />
    </>
  )
}

