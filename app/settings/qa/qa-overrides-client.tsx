'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type QaTier = 'starter' | 'closer' | 'closer_plus' | 'team'

type OverridesEnvelope =
  | {
      ok: true
      data: {
        workspaceId: string
        overrides: Array<QaOverride>
      }
    }
  | { ok: false; error?: { message?: string } }

type QaOverride = {
  id: string
  target_user_id: string
  target_email: string | null
  override_tier: QaTier
  expires_at: string | null
  created_at: string
  created_by: string
  revoked_at: string | null
  note: string | null
}

export function QaOverridesClient(props: {
  actorEmail: string
  enabled: boolean
  configured: boolean
  misconfigReason: string | null
  actorAllowlisted: boolean
  actorAllowlistCount: number
  targetAllowlistCount: number
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [overrides, setOverrides] = useState<QaOverride[]>([])
  const [targetEmail, setTargetEmail] = useState('')
  const [tier, setTier] = useState<QaTier>('starter')
  const [expiresMinutes, setExpiresMinutes] = useState<number>(60 * 6)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/qa/overrides', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as OverridesEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        const msg =
          json && 'error' in json && typeof json.error?.message === 'string' ? json.error.message : 'Access restricted.'
        throw new Error(msg)
      }
      setOverrides(json.data.overrides ?? [])
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not load QA overrides.',
        description: e instanceof Error ? e.message : 'Try again.',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const activeOverrides = useMemo(() => {
    const now = Date.now()
    return overrides.filter((o) => {
      if (o.revoked_at) return false
      if (!o.expires_at) return true
      return Date.parse(o.expires_at) > now
    })
  }, [overrides])

  const apply = async () => {
    const email = targetEmail.trim().toLowerCase()
    if (!email) return
    setSaving(true)
    try {
      const res = await fetch('/api/qa/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: email,
          tier,
          expiresInMinutes: expiresMinutes,
          note: note.trim() || undefined,
        }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || 'Override failed.')
      track('qa_override_applied', { tier })
      toast({ title: 'QA override applied.', description: `${email} → ${tier}` })
      setNote('')
      await load()
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'QA override failed.',
        description: e instanceof Error ? e.message : 'Try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const revoke = async (email: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/qa/overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: email }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || 'Revoke failed.')
      track('qa_override_revoked', {})
      toast({ title: 'QA override revoked.', description: email })
      await load()
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Revoke failed.',
        description: e instanceof Error ? e.message : 'Try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-foreground">QA tier overrides</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Internal-only. App-side tier simulation only — no Stripe writes.
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Signed in as <span className="text-foreground">{props.actorEmail}</span>
          </div>
        </div>
        <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10">
          QA Override
        </Badge>
      </div>

      {!props.enabled ? (
        <Card className="border-slate-700/60 bg-slate-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">QA overrides are disabled</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>Set <span className="font-mono text-xs text-foreground">ENABLE_QA_OVERRIDES=true</span> to enable the system.</div>
          </CardContent>
        </Card>
      ) : !props.configured ? (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Configuration required</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div className="text-foreground">
              {props.misconfigReason ?? 'QA overrides are enabled, but explicit allowlists are not configured.'}
            </div>
            <div>
              Set both env vars (comma-separated emails):
              <div className="mt-2 font-mono text-xs text-foreground">
                QA_OVERRIDE_ACTOR_EMAILS<br />
                QA_OVERRIDE_TARGET_EMAILS
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Current allowlists: actors={props.actorAllowlistCount}, targets={props.targetAllowlistCount}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Apply override</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="qa_target">Target user email (internal test accounts only)</Label>
              <Input
                id="qa_target"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="you@dazrael.com"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qa_tier">Override tier</Label>
              <select
                id="qa_tier"
                value={tier}
                onChange={(e) => setTier(e.target.value as QaTier)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="starter">Starter</option>
                <option value="closer">Closer</option>
                <option value="closer_plus">Closer+</option>
                <option value="team">Team</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="qa_expires">Expires (minutes)</Label>
              <Input
                id="qa_expires"
                type="number"
                min={5}
                max={60 * 24 * 30}
                value={expiresMinutes}
                onChange={(e) => setExpiresMinutes(Number(e.target.value))}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="qa_note">Note (optional)</Label>
              <Input id="qa_note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., mobile tier QA" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => void apply()}
              disabled={saving || !props.enabled || !props.configured || targetEmail.trim().length === 0}
              className="w-full sm:w-auto min-h-10 neon-border hover:glow-effect"
            >
              {saving ? 'Saving…' : 'Apply override'}
            </Button>
            <Button onClick={() => void load()} disabled={saving} variant="outline" className="w-full sm:w-auto min-h-10">
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Active overrides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : activeOverrides.length === 0 ? (
            <div className="text-muted-foreground">No active QA overrides.</div>
          ) : (
            <div className="space-y-2">
              {activeOverrides.map((o) => {
                const email = o.target_email ?? o.target_user_id
                return (
                  <div
                    key={o.id}
                    className="flex flex-col gap-2 rounded border border-cyan-500/10 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{email}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Tier: <span className="text-foreground">{o.override_tier}</span>
                        {o.expires_at ? (
                          <>
                            {' '}
                            · Expires: <span className="text-foreground">{new Date(o.expires_at).toLocaleString()}</span>
                          </>
                        ) : null}
                      </div>
                      {o.note ? <div className="mt-1 text-xs text-muted-foreground">{o.note}</div> : null}
                    </div>
                    {o.target_email ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto min-h-10"
                        onClick={() => void revoke(o.target_email!)}
                        disabled={saving}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

