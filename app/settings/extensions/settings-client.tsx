'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type ActionRow = {
  id: string
  name: string
  description: string | null
  endpoint_id: string
  is_enabled: boolean
  payload_template: Record<string, unknown>
  created_at: string
}

type Endpoint = { id: string; url: string; events: string[]; is_enabled: boolean }

type ProgramsEnvelope =
  | {
      ok: true
      data: {
        programs: Array<{ id: string; account_name: string | null; account_domain: string | null; program_state: string; updated_at: string }>
      }
    }
  | { ok: false }

type ActionsEnvelope =
  | { ok: true; data: { workspaceId: string; extensionsEnabled: boolean; actions: ActionRow[] } }
  | { ok: false; error?: { message?: string } }

type WebhooksEnvelope =
  | { ok: true; data: { endpoints: Endpoint[] } }
  | { ok: false; error?: { message?: string } }

export function ExtensionsSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [actions, setActions] = useState<ActionRow[]>([])
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [programs, setPrograms] = useState<Array<{ id: string; label: string }>>([])

  const [name, setName] = useState('CRM Handoff Package')
  const [description, setDescription] = useState<string>('Deliver a compact package to a configured webhook destination.')
  const [endpointId, setEndpointId] = useState<string>('')
  const [templateJson, setTemplateJson] = useState<string>(
    JSON.stringify(
      {
        account: {
          id: '{{account.id}}',
          name: '{{account.name}}',
          domain: '{{account.domain}}',
          program_state: '{{account.program_state}}',
        },
        workspace: { id: '{{workspace.id}}' },
        computedAt: '{{computedAt}}',
      },
      null,
      2
    )
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, wRes, pRes] = await Promise.all([
        fetch('/api/workspace/extensions/custom-actions', { cache: 'no-store' }),
        fetch('/api/team/webhooks', { cache: 'no-store' }),
        fetch('/api/team/portfolio?limit=100', { cache: 'no-store' }),
      ])
      const aJson = (await aRes.json().catch(() => null)) as ActionsEnvelope | null
      const wJson = (await wRes.json().catch(() => null)) as WebhooksEnvelope | null
      const pJson = (await pRes.json().catch(() => null)) as ProgramsEnvelope | null

      if (!aRes.ok || !aJson || aJson.ok !== true) throw new Error('Extensions unavailable.')
      setEnabled(Boolean(aJson.data.extensionsEnabled))
      setActions(aJson.data.actions ?? [])

      if (wRes.ok && wJson && wJson.ok === true) setEndpoints(wJson.data.endpoints ?? [])
      else setEndpoints([])

      if (pRes.ok && pJson && pJson.ok === true) {
        const items = (pJson.data.programs ?? []).map((p) => {
          const name = p.account_name ?? 'Account'
          const dom = p.account_domain ? ` (${p.account_domain})` : ''
          return { id: p.id, label: `${name}${dom}` }
        })
        setPrograms(items)
      } else setPrograms([])

      if (!endpointId && wJson && wJson.ok === true && (wJson.data.endpoints ?? []).length > 0) {
        setEndpointId(wJson.data.endpoints[0]?.id ?? '')
      }

      track('extension_catalog_viewed', { enabled: Boolean(aJson.data.extensionsEnabled) })
    } catch (e) {
      toast({ title: 'Extensions unavailable', description: e instanceof Error ? e.message : 'Failed to load', variant: 'destructive' })
      setActions([])
      setEndpoints([])
      setPrograms([])
      setEnabled(false)
    } finally {
      setLoading(false)
    }
  }, [endpointId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const endpointById = useMemo(() => new Map(endpoints.map((e) => [e.id, e])), [endpoints])

  async function create() {
    if (!enabled) {
      toast({ title: 'Extensions disabled', description: 'Enable in Platform settings first.', variant: 'destructive' })
      return
    }
    let tpl: unknown = null
    try {
      tpl = JSON.parse(templateJson)
    } catch {
      toast({ title: 'Invalid JSON', description: 'Payload template must be valid JSON.', variant: 'destructive' })
      return
    }
    const res = await fetch('/api/workspace/extensions/custom-actions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, endpointId, payloadTemplate: tpl }),
    })
    const json = (await res.json().catch(() => null)) as any
    if (!res.ok || !json || json.ok !== true) {
      toast({ title: 'Create failed', description: json?.error?.message ?? 'Please try again.', variant: 'destructive' })
      return
    }
    toast({ title: 'Custom action created' })
    track('custom_action_created', {})
    await load()
  }

  async function setEnabledAction(id: string, isEnabled: boolean) {
    const res = await fetch('/api/workspace/extensions/custom-actions', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, isEnabled }),
    })
    const json = (await res.json().catch(() => null)) as any
    if (!res.ok || !json || json.ok !== true) {
      toast({ title: 'Update failed', description: json?.error?.message ?? 'Please try again.', variant: 'destructive' })
      return
    }
    await load()
  }

  async function run(actionId: string, accountProgramId: string) {
    const res = await fetch('/api/workspace/extensions/custom-actions/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, accountProgramId }),
    })
    const json = (await res.json().catch(() => null)) as any
    if (!res.ok || !json || json.ok !== true) {
      toast({ title: 'Run failed', description: json?.error?.message ?? 'Please try again.', variant: 'destructive' })
      return
    }
    toast({ title: 'Enqueued', description: json.data?.webhookDeliveryId ? `Delivery: ${json.data.webhookDeliveryId}` : 'Check webhook settings.' })
    track('custom_action_executed', {})
  }

  return (
    <div className="space-y-4" data-testid="extensions-settings-page">
      <Card>
        <CardHeader>
          <CardTitle>Extensions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Custom actions are bounded, validated payload templates delivered via configured webhooks.</div>
          {!enabled ? (
            <div>
              <Badge variant="outline">Disabled</Badge>{' '}
              <a className="underline" href="/settings/platform">
                Enable extensions
              </a>
            </div>
          ) : (
            <Badge variant="outline">Enabled</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create custom action</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Name</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Webhook endpoint</div>
              <select
                className="h-10 rounded border border-border bg-background px-3 text-sm"
                value={endpointId}
                onChange={(e) => setEndpointId(e.target.value)}
                disabled={loading}
              >
                {endpoints.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.url}
                  </option>
                ))}
              </select>
              {endpointId && endpointById.get(endpointId) ? (
                <div className="text-xs text-muted-foreground">Events: {(endpointById.get(endpointId)?.events ?? []).join(', ') || '—'}</div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Description</div>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Payload template (JSON, with allowed vars)</div>
            <Textarea value={templateJson} onChange={(e) => setTemplateJson(e.target.value)} className="font-mono text-xs" rows={10} />
            <div className="text-xs text-muted-foreground">
              Allowed vars:{' '}
              <span className="font-mono">
                {'{{account.id}} {{account.name}} {{account.domain}} {{account.program_state}} {{account.lead_id}} {{workspace.id}} {{computedAt}}'}
              </span>
            </div>
          </div>

          <Button onClick={() => void create()} disabled={loading || !enabled || !name.trim() || !endpointId}>
            Create action
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Custom actions</CardTitle>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {actions.length === 0 ? <div className="text-sm text-muted-foreground">No custom actions.</div> : null}
          {actions.map((a) => (
            <CustomActionRow key={a.id} action={a} programs={programs} onToggle={setEnabledAction} onRun={run} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function CustomActionRow(props: {
  action: ActionRow
  programs: Array<{ id: string; label: string }>
  onToggle: (id: string, enabled: boolean) => void
  onRun: (actionId: string, accountProgramId: string) => void
}) {
  const [accountProgramId, setAccountProgramId] = useState<string>(props.programs[0]?.id ?? '')
  return (
    <div className="rounded border border-border/60 bg-background/20 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium text-foreground">{props.action.name}</div>
          <div className="text-xs text-muted-foreground">{props.action.description ?? '—'}</div>
        </div>
        <div className="flex items-center gap-2">
          {props.action.is_enabled ? <Badge variant="outline">enabled</Badge> : <Badge variant="secondary">disabled</Badge>}
          <Button size="sm" variant="secondary" onClick={() => props.onToggle(props.action.id, !props.action.is_enabled)}>
            {props.action.is_enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded border border-border bg-background px-2 text-sm"
          value={accountProgramId}
          onChange={(e) => setAccountProgramId(e.target.value)}
        >
          {props.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={() => props.onRun(props.action.id, accountProgramId)} disabled={!accountProgramId || !props.action.is_enabled}>
          Run
        </Button>
      </div>
    </div>
  )
}

