'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type KeyRow = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  created_at: string
  revoked_at: string | null
  last_used_at: string | null
}

type Envelope =
  | { ok: true; data: { workspaceId: string; keys: KeyRow[] } }
  | { ok: false; error?: { message?: string } }

export function ApiSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [keys, setKeys] = useState<KeyRow[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [name, setName] = useState('Automation key')
  const [scopes, setScopes] = useState<Record<string, boolean>>({
    'workspace.read': true,
    'accounts.read': true,
    'action_queue.read': true,
  })
  const [rawKey, setRawKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/platform/keys', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) throw new Error('Access restricted.')
      setKeys(json.data.keys ?? [])
      setWorkspaceId(json.data.workspaceId ?? null)
      track('api_settings_viewed', { workspaceId: json.data.workspaceId ?? null })
    } catch (e) {
      toast({ title: 'API access unavailable', description: e instanceof Error ? e.message : 'Failed to load', variant: 'destructive' })
      setKeys([])
      setWorkspaceId(null)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const selectedScopes = useMemo(() => Object.entries(scopes).filter(([, v]) => v).map(([k]) => k), [scopes])

  async function createKey() {
    setRawKey(null)
    const res = await fetch('/api/platform/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), scopes: selectedScopes }),
    })
    const json = (await res.json().catch(() => null)) as any
    if (!res.ok || !json || json.ok !== true) {
      toast({ title: 'Create failed', description: json?.error?.message ?? 'Please try again.', variant: 'destructive' })
      return
    }
    setRawKey(json.data.rawKey ?? null)
    toast({ title: 'API key created', description: 'Copy the key now. It will not be shown again.' })
    track('api_key_created', { scopesCount: selectedScopes.length })
    await load()
  }

  async function revoke(id: string) {
    const ok = window.confirm('Revoke this API key? This cannot be undone.')
    if (!ok) return
    const res = await fetch('/api/platform/keys', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as any
    if (!res.ok || !json || json.ok !== true) {
      toast({ title: 'Revoke failed', description: json?.error?.message ?? 'Please try again.', variant: 'destructive' })
      return
    }
    toast({ title: 'Revoked.' })
    track('api_key_revoked', {})
    await load()
  }

  return (
    <div className="space-y-4" data-testid="api-settings-page">
      <Card>
        <CardHeader>
          <CardTitle>API access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>
            API keys are workspace-scoped and permissioned. Keys are shown once at creation and stored hashed. Avoid embedding keys in client-side code.
          </div>
          {workspaceId ? <Badge variant="outline">Workspace: {workspaceId}</Badge> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create API key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Scopes</div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(scopes).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScopes((prev) => ({ ...prev, [s]: !prev[s] }))}
                  className={`rounded border px-2 py-1 text-xs ${
                    scopes[s] ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200' : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={() => void createKey()} disabled={loading || !name.trim() || selectedScopes.length === 0}>
            Create key
          </Button>

          {rawKey ? (
            <div className="rounded border border-cyan-500/20 bg-background/30 p-3">
              <div className="text-xs text-muted-foreground">Copy this key now (shown once)</div>
              <div className="mt-1 font-mono text-xs break-all text-foreground">{rawKey}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Keys</CardTitle>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {keys.length === 0 ? <div className="text-sm text-muted-foreground">No keys.</div> : null}
          {keys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 bg-background/20 p-3">
              <div className="space-y-1">
                <div className="font-medium text-foreground">{k.name}</div>
                <div className="text-xs text-muted-foreground">
                  Prefix: <span className="font-mono">{k.prefix}</span> · Scopes: {(k.scopes ?? []).join(', ') || '—'}
                </div>
                <div className="text-xs text-muted-foreground">Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                {k.revoked_at ? <Badge variant="secondary">revoked</Badge> : <Badge variant="outline">active</Badge>}
                {!k.revoked_at ? (
                  <Button size="sm" variant="destructive" onClick={() => void revoke(k.id)}>
                    Revoke
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

