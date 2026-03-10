'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Grant = {
  id: string
  grantee_user_id: string
  granted_role: string
  granted_at: string
  revoked_at: string | null
  note: string | null
  email: string | null
}

type Envelope =
  | { success: true; data: { workspaceId: string; grants: Grant[] } }
  | { success: false; error?: { message?: string } }

export function PartnerAccessClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [grants, setGrants] = useState<Grant[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'manager' | 'rep' | 'viewer'>('viewer')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/partner-access', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      const err = json && json.success === false ? json.error?.message : null
      if (!res.ok || !json || json.success !== true) throw new Error(err ?? 'Failed to load')
      setGrants(json.data.grants ?? [])
      track('partner_access_settings_viewed', { surface: 'settings_partner_access' })
    } catch (e) {
      toast({ title: 'Partner access unavailable', description: e instanceof Error ? e.message : 'Failed to load', variant: 'destructive' })
      setGrants([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function grant() {
    const res = await fetch('/api/settings/partner-access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, role, note: note.trim() || null }),
    })
    const json = (await res.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null
    if (!res.ok || !json || json.success !== true) {
      toast({ title: 'Grant failed', description: json?.error?.message ?? 'Please try again.', variant: 'destructive' })
      return
    }
    toast({ title: 'Delegated access granted' })
    setEmail('')
    setNote('')
    track('delegated_access_granted', { role })
    await load()
  }

  async function revoke(granteeUserId: string) {
    const ok = window.confirm('Revoke delegated access?')
    if (!ok) return
    const res = await fetch('/api/settings/partner-access', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ granteeUserId }),
    })
    const json = (await res.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null
    if (!res.ok || !json || json.success !== true) {
      toast({ title: 'Revoke failed', description: json?.error?.message ?? 'Please try again.', variant: 'destructive' })
      return
    }
    toast({ title: 'Delegated access revoked' })
    track('delegated_access_revoked', {})
    await load()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Delegated partner/operator access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="text-muted-foreground">
            Delegated access is explicit and revocable. It grants workspace-scoped access for support and rollout workflows without mixing client data across workspaces.
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="text-xs text-muted-foreground">User email</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@agency.com" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Role</div>
              <select
                className="h-10 w-full rounded border border-cyan-500/20 bg-background/30 px-2 text-sm text-foreground"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
              >
                <option value="viewer">viewer</option>
                <option value="rep">rep</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <div className="text-xs text-muted-foreground">Note (optional)</div>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., rollout support" />
            </div>
          </div>
          <Button onClick={() => void grant()} disabled={loading || !email.trim()}>
            Grant delegated access
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Active grants</CardTitle>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {grants.length === 0 ? <div className="text-sm text-muted-foreground">No delegated access grants.</div> : null}
          {grants.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 bg-background/20 p-3">
              <div className="space-y-1">
                <div className="font-medium text-foreground">{g.email ?? g.grantee_user_id}</div>
                <div className="text-xs text-muted-foreground">{g.note ?? '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{g.granted_role}</Badge>
                {g.revoked_at ? <Badge variant="secondary">revoked</Badge> : <Badge variant="outline">active</Badge>}
                {!g.revoked_at ? (
                  <Button variant="destructive" size="sm" onClick={() => void revoke(g.grantee_user_id)}>
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

