'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { formatRelativeDate } from '@/lib/domain/explainability'
import { Badge } from '@/components/ui/badge'
import { badgeClassForTone, webhookDeliveryStatusLabel } from '@/lib/ui/status-labels'

type Role = 'owner' | 'admin' | 'member'

type WebhookEndpoint = {
  id: string
  url: string
  events: string[]
  is_enabled: boolean
  created_at: string
  secret_last4?: string | null
  rotated_at?: string | null
  last_success_at: string | null
  last_error_at: string | null
  failure_count: number
}

type DeliveryRow = {
  id: string
  event_type: string
  status: string
  attempts: number
  last_status: number | null
  last_error: string | null
  created_at: string
}

const EVENT_CHOICES = [
  'account.created',
  'account.updated',
  'account.brief.generated',
  'account.exported',
  'account.pushed',
  'signal.detected',
  'pitch.generated',
  'digest.sent',
  'template.approved',
  'member.invited',
  'member.role_changed',
  'billing.subscription_updated',
  'webhook.test',
] as const

export function IntegrationsSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>('member')
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [createUrl, setCreateUrl] = useState('')
  const [createEvents, setCreateEvents] = useState<string[]>(['webhook.test'])
  const [creating, setCreating] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [activeEndpointId, setActiveEndpointId] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])

  const isAdmin = role === 'owner' || role === 'admin'

  const activeEndpoint = useMemo(
    () => endpoints.find((e) => e.id === activeEndpointId) ?? null,
    [endpoints, activeEndpointId]
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/team/webhooks', { cache: 'no-store' })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      const json = (await res.json()) as { ok?: boolean; data?: { role?: Role; endpoints?: WebhookEndpoint[] } }
      setRole(json.data?.role ?? 'member')
      setEndpoints(json.data?.endpoints ?? [])
    } catch {
      toast({ variant: 'destructive', title: 'Load failed', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  async function loadDeliveries(endpointId: string) {
    try {
      const res = await fetch(`/api/team/webhooks/${endpointId}/deliveries`, { cache: 'no-store' })
      if (!res.ok) {
        setDeliveries([])
        return
      }
      const json = (await res.json()) as { ok?: boolean; data?: { deliveries?: DeliveryRow[] } }
      setDeliveries(json.data?.deliveries ?? [])
    } catch {
      setDeliveries([])
    }
  }

  function deliveryStatusBadge(d: DeliveryRow) {
    const stRaw = d.status
    const st = stRaw === 'pending' || stRaw === 'sent' || stRaw === 'failed' ? stRaw : 'pending'
    const label = webhookDeliveryStatusLabel(st, d.attempts ?? 0)
    return (
      <Badge variant="outline" className={badgeClassForTone(label.tone)}>
        {label.label}
      </Badge>
    )
  }

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!activeEndpointId) return
    void loadDeliveries(activeEndpointId)
  }, [activeEndpointId])

  async function createEndpoint() {
    setCreating(true)
    setRevealedSecret(null)
    try {
      const res = await fetch('/api/team/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: createUrl, events: createEvents }),
      })
      const json = (await res.json()) as { ok?: boolean; data?: { endpoint?: WebhookEndpoint; secret?: string } }
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
        return
      }
      toast({ title: 'Saved.' })
      setRevealedSecret(json.data?.secret ?? null)
      setCreateUrl('')
      await refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
    } finally {
      setCreating(false)
    }
  }

  async function toggleEnabled(endpointId: string, next: boolean) {
    try {
      const res = await fetch(`/api/team/webhooks/${endpointId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: next }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      toast({ title: 'Saved.' })
      await refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
    }
  }

  async function rotateSecret(endpointId: string) {
    const ok = window.confirm('Rotate secret?')
    if (!ok) return
    setRevealedSecret(null)
    try {
      const res = await fetch(`/api/team/webhooks/${endpointId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotate: true }),
      })
      const json = (await res.json()) as { ok?: boolean; data?: { secret?: string } }
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      setRevealedSecret(json.data?.secret ?? null)
      toast({ title: 'Saved.' })
      await refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Rotate failed', description: 'Please try again.' })
    }
  }

  async function sendTest(endpointId: string) {
    try {
      const res = await fetch(`/api/team/webhooks/${endpointId}/test`, { method: 'POST' })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Send failed', description: 'Please try again.' })
        return
      }
      toast({ title: 'Sent.' })
      await loadDeliveries(endpointId)
    } catch {
      toast({ variant: 'destructive', title: 'Send failed', description: 'Please try again.' })
    }
  }

  function toggleEvent(e: string) {
    setCreateEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : prev.concat(e)))
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="integrations-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Webhooks and exports.</p>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Webhooks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {isAdmin && (
              <div className="space-y-3" data-testid="webhooks-create">
                <Input
                  value={createUrl}
                  onChange={(e) => setCreateUrl(e.target.value)}
                  placeholder="https://hooks.example.com/leadintel"
                  data-testid="webhooks-create-url"
                />
                <div className="flex flex-wrap gap-2">
                  {EVENT_CHOICES.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={`px-2 py-1 rounded border text-xs ${
                        createEvents.includes(e) ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200' : 'border-cyan-500/10 hover:bg-muted/50'
                      }`}
                      onClick={() => toggleEvent(e)}
                      data-testid={`webhooks-event-${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => void createEndpoint()}
                  disabled={creating || createUrl.trim().length === 0}
                  className="neon-border hover:glow-effect"
                  data-testid="webhooks-create-submit"
                >
                  {creating ? 'Saving…' : 'Create webhook'}
                </Button>
                {revealedSecret && (
                  <div className="rounded-md border border-cyan-500/10 bg-card/30 p-3">
                    <div className="text-xs text-muted-foreground">Secret (shown once)</div>
                    <div className="mt-1 break-all text-xs text-foreground" data-testid="webhooks-secret">
                      {revealedSecret}
                    </div>
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <div>Loading…</div>
            ) : endpoints.length === 0 ? (
              <div>No webhooks configured.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  {endpoints.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={`w-full text-left rounded-md border p-3 ${
                        activeEndpointId === e.id ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-cyan-500/10 hover:bg-muted/50'
                      }`}
                      onClick={() => setActiveEndpointId(e.id)}
                      data-testid={`webhooks-row-${e.id}`}
                    >
                      <div className="text-foreground font-medium truncate">{e.url}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.is_enabled ? 'Enabled' : 'Disabled'} · {e.events?.length ?? 0} events
                      </div>
                    </button>
                  ))}
                </div>

                <div className="rounded-md border border-cyan-500/10 bg-card/30 p-3">
                  {!activeEndpoint ? (
                    <div>Select a webhook.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-foreground font-medium">Endpoint</div>
                      <div className="text-xs break-all">{activeEndpoint.url}</div>
                      <div className="text-xs text-muted-foreground">
                        Secret ending:{' '}
                        {activeEndpoint.secret_last4 ? (
                          <span className="text-foreground">•••• {activeEndpoint.secret_last4}</span>
                        ) : (
                          <span>Not available</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last rotated:{' '}
                        {activeEndpoint.rotated_at ? (
                          <span className="text-foreground" title={activeEndpoint.rotated_at}>
                            {formatRelativeDate(activeEndpoint.rotated_at)}
                          </span>
                        ) : (
                          <span>Not available</span>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void toggleEnabled(activeEndpoint.id, !activeEndpoint.is_enabled)}
                            data-testid="webhooks-toggle-enabled"
                          >
                            {activeEndpoint.is_enabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void rotateSecret(activeEndpoint.id)}
                            data-testid="webhooks-rotate"
                          >
                            Rotate secret
                          </Button>
                          <Button size="sm" onClick={() => void sendTest(activeEndpoint.id)} data-testid="webhooks-send-test">
                            Send test event
                          </Button>
                        </div>
                      )}

                      <div className="pt-2 border-t border-cyan-500/10">
                        <div className="text-foreground font-medium">Deliveries</div>
                        <div className="mt-2 space-y-2" data-testid="webhooks-deliveries">
                          {deliveries.length === 0 ? (
                            <div className="text-xs text-muted-foreground">No deliveries yet.</div>
                          ) : (
                            deliveries.map((d) => (
                              <div key={d.id} className="text-xs rounded border border-cyan-500/10 p-2">
                                <div className="flex flex-wrap items-center gap-2 text-foreground">
                                  <span className="font-medium">{d.event_type}</span>
                                  {deliveryStatusBadge(d)}
                                  <span className="text-muted-foreground">attempts {d.attempts}</span>
                                </div>
                                <div className="text-muted-foreground">
                                  {d.last_status ? `HTTP ${d.last_status}` : d.last_error ? d.last_error : '—'}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Exports</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div>
              Use <a className="text-cyan-400 hover:underline" href="/settings/exports">Exports</a> to generate downloadable CSV files.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

