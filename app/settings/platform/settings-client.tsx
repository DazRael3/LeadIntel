'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Role = 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'

type PoliciesEnvelope =
  | {
      ok: true
      data: {
        workspace: { id: string; name: string }
        role: Role
        policies: {
          platform: {
            apiAccessEnabled: boolean
            embedEnabled: boolean
            extensionsEnabled: boolean
            apiKeyManageRoles: Role[]
            allowedKeyScopes: string[]
          }
        }
      }
    }
  | { ok: false }

type ReviewLinksEnvelope =
  | { ok: true; data: { workspaceId: string; links: Array<{ id: string; expires_at: string; created_at: string; revoked_at: string | null; last_used_at: string | null; use_count: number }> } }
  | { ok: false; error?: { message?: string } }

export function PlatformSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>('viewer')
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null)
  const [apiEnabled, setApiEnabled] = useState(false)
  const [embedEnabled, setEmbedEnabled] = useState(false)
  const [extensionsEnabled, setExtensionsEnabled] = useState(false)
  const [manageRoles, setManageRoles] = useState<Role[]>(['owner', 'admin', 'manager'])
  const [reviewLinks, setReviewLinks] = useState<Array<{ id: string; expires_at: string; created_at: string; revoked_at: string | null; last_used_at: string | null; use_count: number }>>(
    []
  )
  const [creatingReview, setCreatingReview] = useState(false)
  const [latestReviewLinks, setLatestReviewLinks] = useState<null | Record<string, string>>(null)

  const canEdit = role === 'owner' || role === 'admin' || role === 'manager'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, reviewRes] = await Promise.all([
        fetch('/api/workspace/policies', { cache: 'no-store' }),
        fetch('/api/review-links', { cache: 'no-store' }),
      ])
      const json = (await res.json().catch(() => null)) as PoliciesEnvelope | null
      if (!res.ok || !json || json.ok !== true) throw new Error('Access restricted.')
      setWorkspace({ id: json.data.workspace.id, name: json.data.workspace.name })
      setRole(json.data.role)
      setApiEnabled(Boolean(json.data.policies.platform.apiAccessEnabled))
      setEmbedEnabled(Boolean(json.data.policies.platform.embedEnabled))
      setExtensionsEnabled(Boolean(json.data.policies.platform.extensionsEnabled))
      setManageRoles((json.data.policies.platform.apiKeyManageRoles ?? ['owner', 'admin', 'manager']) as Role[])
      track('api_settings_viewed', { surface: 'platform_governance' })

      if (reviewRes.ok) {
        const rjson = (await reviewRes.json().catch(() => null)) as ReviewLinksEnvelope | null
        if (rjson && rjson.ok === true) {
          setReviewLinks(rjson.data.links ?? [])
        } else {
          setReviewLinks([])
        }
      } else {
        setReviewLinks([])
      }
    } catch (e) {
      toast({ title: 'Platform settings unavailable', description: e instanceof Error ? e.message : 'Failed to load', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const scopeList = useMemo(
    () => ['workspace.read', 'accounts.read', 'action_queue.read', 'delivery.read', 'benchmarks.read', 'embed.token.create'],
    []
  )

  async function save() {
    const res = await fetch('/api/workspace/policies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        platform: {
          apiAccessEnabled: apiEnabled,
          embedEnabled,
          extensionsEnabled,
          apiKeyManageRoles: manageRoles,
          allowedKeyScopes: scopeList,
        },
      }),
    })
    const json = (await res.json().catch(() => null)) as any
    if (!res.ok || !json || json.ok !== true) {
      toast({ title: 'Save failed', description: json?.error?.message ?? 'Please try again.', variant: 'destructive' })
      return
    }
    toast({ title: 'Saved.' })
    track('platform_governance_updated', { apiEnabled, embedEnabled, extensionsEnabled })
    await load()
  }

  function toggleRole(r: Role) {
    setManageRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  async function createReviewLink() {
    setCreatingReview(true)
    setLatestReviewLinks(null)
    try {
      const res = await fetch('/api/review-links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expiresInMinutes: 60 }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { links?: Record<string, string> }; error?: { message?: string } } | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ title: 'Create failed', description: json?.error?.message ?? 'Access restricted.', variant: 'destructive' })
        return
      }
      setLatestReviewLinks(json.data?.links ?? null)
      toast({ title: 'Review link created', description: 'Share one of the destination links below.' })
      await load()
    } finally {
      setCreatingReview(false)
    }
  }

  async function revokeReviewLink(id: string) {
    const res = await fetch('/api/review-links', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      toast({ title: 'Revoke failed', description: 'Access restricted.', variant: 'destructive' })
      return
    }
    toast({ title: 'Revoked' })
    await load()
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'Copied' })
    } catch {
      toast({ title: 'Copy failed', description: 'Copy manually from the text field.', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4" data-testid="platform-settings-page">
      <Card>
        <CardHeader>
          <CardTitle>Platform governance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>These controls gate API keys, embeds, and extensions server-side.</div>
          {workspace ? <Badge variant="outline">Workspace: {workspace.name}</Badge> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-foreground">API access</div>
              <div className="text-xs text-muted-foreground">Enable workspace-scoped API keys and `/api/v1/*` routes.</div>
            </div>
            <input type="checkbox" checked={apiEnabled} onChange={(e) => setApiEnabled(e.target.checked)} disabled={!canEdit || loading} />
          </label>

          <label className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-foreground">Embeds</div>
              <div className="text-xs text-muted-foreground">Allow signed embed tokens and `/embed/*` widgets.</div>
            </div>
            <input type="checkbox" checked={embedEnabled} onChange={(e) => setEmbedEnabled(e.target.checked)} disabled={!canEdit || loading} />
          </label>

          <label className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-foreground">Extensions</div>
              <div className="text-xs text-muted-foreground">Enable custom action definitions (bounded and validated).</div>
            </div>
            <input type="checkbox" checked={extensionsEnabled} onChange={(e) => setExtensionsEnabled(e.target.checked)} disabled={!canEdit || loading} />
          </label>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Who can manage API keys</div>
            <div className="flex flex-wrap gap-2">
              {(['owner', 'admin', 'manager', 'rep', 'viewer'] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRole(r)}
                  disabled={!canEdit || loading}
                  className={`rounded border px-2 py-1 text-xs ${
                    manageRoles.includes(r)
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={() => void save()} disabled={!canEdit || loading || manageRoles.length === 0}>
            Save
          </Button>
          {!canEdit ? <div className="text-xs text-muted-foreground">Only owner/admin/manager can edit platform settings.</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review access (temporary)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            Generates a short-lived signed Review Mode link for external reviewers. Review Mode is read-only (writes are blocked server-side).
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void createReviewLink()} disabled={!canEdit || loading || creatingReview}>
              Create 60m review link
            </Button>
            {!canEdit ? <div className="text-xs text-muted-foreground">Only owner/admin/manager can create or revoke review links.</div> : null}
          </div>

          {latestReviewLinks ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Destination links</div>
              {Object.entries(latestReviewLinks).map(([k, url]) => (
                <div key={k} className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{k}</Badge>
                  <input className="flex-1 min-w-[260px] rounded border bg-background px-2 py-1 text-xs" value={url} readOnly />
                  <Button size="sm" variant="outline" onClick={() => void copy(url)}>
                    Copy
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Recent review links</div>
            {reviewLinks.length === 0 ? (
              <div className="text-xs text-muted-foreground">No links.</div>
            ) : (
              <div className="space-y-2">
                {reviewLinks.map((l) => {
                  const expired = Date.now() >= Date.parse(l.expires_at)
                  const active = !l.revoked_at && !expired
                  return (
                    <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                      <div className="min-w-[240px]">
                        <div className="text-xs text-foreground">Link {l.id.slice(0, 8)}…</div>
                        <div className="text-[11px] text-muted-foreground">
                          Expires {new Date(l.expires_at).toLocaleString()} · Used {l.use_count}×
                          {l.last_used_at ? ` · Last used ${new Date(l.last_used_at).toLocaleString()}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={active ? 'outline' : 'secondary'}>{active ? 'active' : l.revoked_at ? 'revoked' : 'expired'}</Badge>
                        <Button size="sm" variant="destructive" disabled={!canEdit || !active} onClick={() => void revokeReviewLink(l.id)}>
                          Revoke
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

