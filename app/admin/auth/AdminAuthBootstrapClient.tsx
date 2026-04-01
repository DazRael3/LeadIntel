'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

type Tier = 'starter' | 'closer' | 'closer_plus' | 'team'

type BootstrapEnvelope =
  | { ok: true; data: { userId: string; email: string; tier: Tier; workspaceId: string | null; notes: string[] } }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

export function AdminAuthBootstrapClient() {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tier, setTier] = useState<Tier>('closer')
  const [confirmEmail, setConfirmEmail] = useState(true)
  const [resetPassword, setResetPassword] = useState(true)
  const [loading, setLoading] = useState(false)
  const [last, setLast] = useState<BootstrapEnvelope | null>(null)

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 8 && !loading
  }, [email, password.length, loading])

  async function submit() {
    if (!canSubmit) return
    setLoading(true)
    setLast(null)
    try {
      const res = await fetch('/api/admin/auth/bootstrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          tier,
          confirmEmail,
          resetPassword,
        }),
      })
      const json = (await res.json().catch(() => null)) as BootstrapEnvelope | null
      if (!res.ok || !json) {
        toast({ variant: 'destructive', title: 'Bootstrap failed', description: 'Unexpected response. Please retry.' })
        setLast(json)
        return
      }
      setLast(json)
      if (json.ok) {
        toast({ title: 'Bootstrap complete', description: `${json.data.email} → ${json.data.tier}` })
      } else {
        toast({ variant: 'destructive', title: 'Bootstrap failed', description: json.error.message })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Bootstrap failed', description: 'Network or server error. Please retry.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Bootstrap internal test users</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Admin session gated</Badge>
          <Badge variant="outline">Creates/updates Auth user</Badge>
          <Badge variant="outline">Ensures workspace</Badge>
          <Badge variant="outline">Sets app tier</Badge>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="closer@dazrael.com" disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a known password (8+ chars)" disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label>Tier</Label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
              disabled={loading}
              className="h-10 w-full rounded border border-cyan-500/20 bg-background/30 px-2 text-sm text-foreground"
            >
              <option value="starter">starter</option>
              <option value="closer">closer</option>
              <option value="closer_plus">closer_plus</option>
              <option value="team">team</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={confirmEmail} onChange={(e) => setConfirmEmail(e.target.checked)} disabled={loading} />
              Confirm email
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={resetPassword} onChange={(e) => setResetPassword(e.target.checked)} disabled={loading} />
              Reset password
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="neon-border hover:glow-effect" onClick={() => void submit()} disabled={!canSubmit}>
              {loading ? 'Working…' : 'Bootstrap user'}
            </Button>
            <div className="text-xs text-muted-foreground">Then log in normally on `/login` with the same email/password.</div>
          </div>
        </div>

        {last ? (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs">
            <div className="font-medium text-foreground">Last result</div>
            <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">{JSON.stringify(last, null, 2)}</pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

