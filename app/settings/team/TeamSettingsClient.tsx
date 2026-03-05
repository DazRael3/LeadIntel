'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'

type Role = 'owner' | 'admin' | 'member'

type MembersPayload = {
  workspace: { id: string; name: string; owner_user_id: string }
  viewer: { userId: string; role: Role }
  members: Array<{
    userId: string
    email: string | null
    displayName: string | null
    role: Role
    createdAt: string
  }>
}

export function TeamSettingsClient() {
  const { toast } = useToast()
  const router = useRouter()
  const sp = useSearchParams()
  const acceptToken = sp.get('accept')

  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<MembersPayload | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  const roleByUserId = useMemo(() => {
    const m = new Map<string, Role>()
    for (const row of payload?.members ?? []) m.set(row.userId, row.role)
    return m
  }, [payload])

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/team/members', { method: 'GET', cache: 'no-store' })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        setPayload(null)
        return
      }
      const json = (await res.json()) as { ok?: boolean; data?: MembersPayload }
      setPayload(json.data ?? null)
    } catch {
      setPayload(null)
      toast({ variant: 'destructive', title: 'Load failed', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  async function acceptInvite(token: string) {
    try {
      const res = await fetch('/api/team/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      toast({ title: 'Invite accepted.' })
      // Remove token from URL to prevent accidental reuse.
      router.replace('/settings/team')
      await refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Accept failed', description: 'Please try again.' })
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!acceptToken) return
    void acceptInvite(acceptToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptToken])

  async function invite() {
    setInviting(true)
    setInviteLink(null)
    try {
      const res = await fetch('/api/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const text = await res.text()
      const json = text ? (JSON.parse(text) as { ok?: boolean; data?: { inviteLink?: string } }) : null
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      toast({ title: 'Invite sent.' })
      const link = json?.data?.inviteLink ?? null
      setInviteLink(typeof link === 'string' ? link : null)
      setInviteEmail('')
      await refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Invite failed', description: 'Please try again.' })
    } finally {
      setInviting(false)
    }
  }

  async function changeRole(targetUserId: string, nextRole: Role) {
    const prev = roleByUserId.get(targetUserId)
    if (prev === nextRole) return

    if (nextRole === 'owner') {
      const ok = window.confirm('Transfer ownership?')
      if (!ok) return
    }

    try {
      const res = await fetch('/api/team/members/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId, role: nextRole }),
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

  async function removeMember(targetUserId: string) {
    const ok = window.confirm('Remove member?')
    if (!ok) return
    try {
      const res = await fetch('/api/team/members/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      toast({ title: 'Removed.' })
      await refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Remove failed', description: 'Please try again.' })
    }
  }

  const isEmpty = !loading && (payload?.members?.length ?? 0) === 0

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="team-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">Members and roles for your workspace.</p>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invite member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@company.com"
                data-testid="team-invite-email"
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value === 'admin' ? 'admin' : 'member')}
                data-testid="team-invite-role"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button
                onClick={() => void invite()}
                disabled={inviting || inviteEmail.trim().length === 0}
                className="neon-border hover:glow-effect"
                data-testid="team-invite-submit"
              >
                {inviting ? 'Sending…' : 'Send invite'}
              </Button>
            </div>

            {inviteLink && (
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <div className="text-xs text-muted-foreground break-all">{inviteLink}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(inviteLink)}
                  data-testid="team-invite-copy-link"
                >
                  Copy link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? (
              <div>Loading…</div>
            ) : isEmpty ? (
              <div>No members found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payload?.members ?? []).map((m) => (
                      <tr key={m.userId} className="border-t border-cyan-500/10">
                        <td className="py-2 pr-4 text-foreground">{m.displayName ?? '—'}</td>
                        <td className="py-2 pr-4">{m.email ?? '—'}</td>
                        <td className="py-2 pr-4">
                          <select
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                            value={m.role}
                            onChange={(e) => void changeRole(m.userId, e.target.value as Role)}
                            data-testid={`team-role-${m.userId}`}
                          >
                          {payload?.viewer.role === 'owner' && <option value="owner">Owner</option>}
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void removeMember(m.userId)}
                            disabled={m.userId === payload?.viewer.userId || m.role === 'owner'}
                            data-testid={`team-remove-${m.userId}`}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

