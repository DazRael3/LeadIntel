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

type ApiErrorEnvelope = {
  ok?: boolean
  error?: { message?: string; details?: unknown; code?: string }
}

type PlanEnvelope =
  | {
      ok: true
      data: {
        tier?: QaTier
        isQaTierOverride?: boolean
        qaOverride?: { tier?: QaTier; expiresAt?: string | null } | null
        qaDebugEligible?: boolean
        debug?: {
          rawSubscriptionTier?: string | null
          effectiveTier?: QaTier
          subscriptionStatus?: string | null
          stripeTrialEnd?: string | null
          qa?: {
            enabled?: boolean
            configured?: boolean
            targetAllowlisted?: boolean
            override?: { tier?: string | null; expiresAt?: string | null; revokedAt?: string | null } | null
            active?: boolean
            blockedReason?:
              | 'disabled'
              | 'misconfigured'
              | 'target_not_allowlisted'
              | 'stripe_active_or_trialing'
              | 'no_override_set'
              | 'revoked'
              | 'expired'
              | null
          }
        } | null
      }
    }
  | { ok: false; error?: { message?: string } }

type OverridesEnvelope =
  | {
      ok: true
      data: {
        enabled?: boolean
        configured?: boolean
        misconfigReason?: string | null
        actor?: { allowlisted?: boolean }
        workspace?: { exists?: boolean; role?: 'owner_admin' | 'member' | 'unknown' }
        api?: { ready?: boolean }
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
  created_by_email?: string | null
  created_by_display?: string | null
  revoked_at: string | null
  revoked_by_email?: string | null
  revoked_by_display?: string | null
  note: string | null
}

const TIER_LABELS: Record<QaTier, { label: string; hint: string }> = {
  starter: { label: 'Starter', hint: 'Preview experience' },
  closer: { label: 'Closer', hint: 'Full individual workflow' },
  closer_plus: { label: 'Closer+', hint: 'More depth + more outputs' },
  team: { label: 'Team', hint: 'Governance + shared rollout' },
}

function formatTier(t: QaTier): string {
  return TIER_LABELS[t]?.label ?? t
}

function formatExpiry(expiresAtIso: string | null): { short: string; title: string } {
  if (!expiresAtIso) return { short: 'No expiry', title: 'No expiry' }
  const ts = Date.parse(expiresAtIso)
  if (!Number.isFinite(ts)) return { short: 'Expiry unknown', title: expiresAtIso }
  const ms = ts - Date.now()
  const abs = new Date(ts).toLocaleString()
  if (ms <= 0) return { short: 'Expired', title: abs }
  const mins = Math.round(ms / 60000)
  if (mins < 60) return { short: `In ${mins}m`, title: abs }
  const hours = Math.round(mins / 60)
  if (hours < 48) return { short: `In ${hours}h`, title: abs }
  const days = Math.round(hours / 24)
  return { short: `In ${days}d`, title: abs }
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
  const [diag, setDiag] = useState<{
    apiReady: boolean
    workspaceExists: boolean
    workspaceRole: 'owner_admin' | 'member' | 'unknown'
  }>({ apiReady: false, workspaceExists: false, workspaceRole: 'unknown' })
  const [targetEmail, setTargetEmail] = useState('')
  const [tier, setTier] = useState<QaTier>('starter')
  const [expiryPreset, setExpiryPreset] = useState<'30m' | '2h' | '6h' | '1d' | '7d' | 'custom'>('6h')
  const [expiresMinutes, setExpiresMinutes] = useState<number>(60 * 6)
  const [note, setNote] = useState('')
  const [tierProof, setTierProof] = useState<{
    loaded: boolean
    effectiveTier: QaTier | null
    rawSubscriptionTier: string | null
    qaActive: boolean
    qaOverrideTier: string | null
    qaExpiresAt: string | null
    blockedReason:
      | 'disabled'
      | 'misconfigured'
      | 'target_not_allowlisted'
      | 'stripe_active_or_trialing'
      | 'no_override_set'
      | 'revoked'
      | 'expired'
      | null
  }>({
    loaded: false,
    effectiveTier: null,
    rawSubscriptionTier: null,
    qaActive: false,
    qaOverrideTier: null,
    qaExpiresAt: null,
    blockedReason: null,
  })

  useEffect(() => {
    if (expiryPreset === 'custom') return
    const presetToMinutes: Record<Exclude<typeof expiryPreset, 'custom'>, number> = {
      '30m': 30,
      '2h': 120,
      '6h': 360,
      '1d': 60 * 24,
      '7d': 60 * 24 * 7,
    }
    setExpiresMinutes(presetToMinutes[expiryPreset])
  }, [expiryPreset])

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
      setDiag({
        apiReady: Boolean(json.data.api?.ready),
        workspaceExists: Boolean(json.data.workspace?.exists),
        workspaceRole: (json.data.workspace?.role ?? 'unknown') as 'owner_admin' | 'member' | 'unknown',
      })

      // Tier proof (best-effort). Only returns details for QA actors/targets.
      try {
        const planRes = await fetch('/api/plan', { method: 'GET', cache: 'no-store' })
        const planJson = (await planRes.json().catch(() => null)) as PlanEnvelope | null
        if (planRes.ok && planJson && planJson.ok === true) {
          const effectiveTier =
            planJson.data?.tier === 'starter' ||
            planJson.data?.tier === 'closer' ||
            planJson.data?.tier === 'closer_plus' ||
            planJson.data?.tier === 'team'
              ? planJson.data.tier
              : null
          const dbg = planJson.data?.debug ?? null
          const qa = dbg?.qa ?? null
          setTierProof({
            loaded: true,
            effectiveTier,
            rawSubscriptionTier: typeof dbg?.rawSubscriptionTier === 'string' ? dbg.rawSubscriptionTier : null,
            qaActive: Boolean(planJson.data?.isQaTierOverride && planJson.data?.qaOverride),
            qaOverrideTier: typeof qa?.override?.tier === 'string' ? qa.override.tier : null,
            qaExpiresAt: typeof qa?.override?.expiresAt === 'string' ? qa.override.expiresAt : null,
            blockedReason:
              qa?.blockedReason === null ||
              qa?.blockedReason === 'disabled' ||
              qa?.blockedReason === 'misconfigured' ||
              qa?.blockedReason === 'target_not_allowlisted' ||
              qa?.blockedReason === 'stripe_active_or_trialing' ||
              qa?.blockedReason === 'no_override_set' ||
              qa?.blockedReason === 'revoked' ||
              qa?.blockedReason === 'expired'
                ? qa.blockedReason
                : null,
          })
        } else {
          setTierProof((p) => ({ ...p, loaded: true }))
        }
      } catch {
        setTierProof((p) => ({ ...p, loaded: true }))
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not load QA overrides.',
        description: e instanceof Error ? e.message : 'Try again.',
      })
      setDiag((d) => ({ ...d, apiReady: false }))
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

  const parseApiError = (json: unknown): { message: string; hint?: string } => {
    const env = json as ApiErrorEnvelope | null
    const msg = typeof env?.error?.message === 'string' ? env.error.message : 'Request failed.'
    const details = env?.error?.details
    if (details && typeof details === 'object') {
      const d = details as Record<string, unknown>
      const first = Object.values(d).find((v) => typeof v === 'string' && v.length > 0)
      if (typeof first === 'string') return { message: msg, hint: first }
    }
    return { message: msg }
  }

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
      const json = (await res.json().catch(() => null)) as unknown
      if (!res.ok || !(json && typeof json === 'object' && 'ok' in (json as Record<string, unknown>) && (json as { ok?: boolean }).ok)) {
        const err = parseApiError(json)
        throw new Error(err.hint ? `${err.message} ${err.hint}` : err.message)
      }
      track('qa_override_applied', { tier })
      toast({ title: 'QA override applied.', description: `${email} → ${formatTier(tier)}` })
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
      const json = (await res.json().catch(() => null)) as unknown
      if (!res.ok || !(json && typeof json === 'object' && 'ok' in (json as Record<string, unknown>) && (json as { ok?: boolean }).ok)) {
        const err = parseApiError(json)
        throw new Error(err.hint ? `${err.message} ${err.hint}` : err.message)
      }
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

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 bg-cyan-500/10">
              {props.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
            <Badge
              variant="outline"
              className={props.configured ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' : 'border-red-500/30 text-red-300 bg-red-500/10'}
            >
              {props.configured ? 'Configured' : 'Misconfigured'}
            </Badge>
            <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10">
              Actor allowlisted
            </Badge>
            <Badge
              variant="outline"
              className={diag.apiReady ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' : 'border-slate-700/60 text-muted-foreground bg-slate-900/40'}
            >
              {diag.apiReady ? 'API ready' : 'API not ready'}
            </Badge>
          </div>

          <div className="text-xs">
            Allowlists: actors={props.actorAllowlistCount}, targets={props.targetAllowlistCount}
          </div>
          <div className="text-xs">
            Workspace: {diag.workspaceExists ? 'present' : 'none'}{diag.workspaceExists ? ` (${diag.workspaceRole})` : ''}.
            {diag.workspaceExists ? null : ' Apply/Revoke requires a workspace (for audit scoping).'}
          </div>
          {!props.configured && props.misconfigReason ? <div className="text-xs text-red-200">{props.misconfigReason}</div> : null}

          <div className="pt-2 border-t border-cyan-500/10">
            <div className="text-xs font-semibold text-foreground">Tier proof (current session)</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Overrides only affect the account you’re signed in as. When auditing tiers, confirm your storageState/session matches the target email.
            </div>
            {!tierProof.loaded ? (
              <div className="mt-2 text-xs text-muted-foreground">Loading tier diagnostics…</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-slate-700/60 text-muted-foreground bg-slate-900/40">
                  Effective: {tierProof.effectiveTier ? formatTier(tierProof.effectiveTier) : 'Unknown'}
                </Badge>
                <Badge variant="outline" className="border-slate-700/60 text-muted-foreground bg-slate-900/40">
                  Raw subscription_tier: {tierProof.rawSubscriptionTier ?? 'Unknown'}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    tierProof.qaActive ? 'border-purple-500/30 text-purple-300 bg-purple-500/10' : 'border-slate-700/60 text-muted-foreground bg-slate-900/40'
                  }
                >
                  {tierProof.qaActive ? 'QA override active' : 'QA override inactive'}
                </Badge>
                {tierProof.qaOverrideTier ? (
                  <Badge variant="outline" className="border-purple-500/30 text-purple-200 bg-purple-500/10">
                    Override: {tierProof.qaOverrideTier}
                  </Badge>
                ) : null}
                {tierProof.qaExpiresAt ? (
                  <Badge variant="outline" className="border-purple-500/30 text-purple-200 bg-purple-500/10" title={new Date(tierProof.qaExpiresAt).toLocaleString()}>
                    Expires: {formatExpiry(tierProof.qaExpiresAt).short}
                  </Badge>
                ) : null}
                {tierProof.blockedReason ? (
                  <Badge variant="outline" className="border-amber-500/30 text-amber-200 bg-amber-500/10">
                    Blocked: {tierProof.blockedReason}
                  </Badge>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
          {!diag.workspaceExists ? (
            <div className="rounded border border-slate-700/60 bg-slate-900/40 p-3 text-sm text-muted-foreground">
              Apply/Revoke requires a current workspace (for audit scoping). If you don’t have one yet, create/select a workspace first.
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="qa_target">Target user email</Label>
              <Input
                id="qa_target"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="qa-team@dazrael.com"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
              />
              <div className="text-xs text-muted-foreground">Must be allowlisted in `QA_OVERRIDE_TARGET_EMAILS`.</div>
            </div>

            <div className="space-y-2">
              <Label>Override tier</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TIER_LABELS) as QaTier[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    className={[
                      'min-h-10 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      t === tier
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-foreground'
                        : 'border-input bg-background text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                    aria-pressed={t === tier}
                  >
                    <div className="font-medium">{TIER_LABELS[t].label}</div>
                    <div className="text-xs opacity-80">{TIER_LABELS[t].hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="qa_expiry_preset">Expiry</Label>
              <select
                id="qa_expiry_preset"
                value={expiryPreset}
                onChange={(e) => setExpiryPreset(e.target.value as typeof expiryPreset)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="30m">30 minutes (safe quick test)</option>
                <option value="2h">2 hours</option>
                <option value="6h">6 hours</option>
                <option value="1d">1 day</option>
                <option value="7d">7 days</option>
                <option value="custom">Custom…</option>
              </select>
              {expiryPreset === 'custom' ? (
                <div className="space-y-2">
                  <Label htmlFor="qa_expires" className="text-xs text-muted-foreground">
                    Custom (minutes)
                  </Label>
                  <Input
                    id="qa_expires"
                    type="number"
                    min={5}
                    max={60 * 24 * 30}
                    value={expiresMinutes}
                    onChange={(e) => setExpiresMinutes(Number(e.target.value))}
                  />
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">Keep it short; overrides should auto-expire.</div>
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
                const expiry = formatExpiry(o.expires_at)
                return (
                  <div
                    key={o.id}
                    className="flex flex-col gap-2 rounded border border-cyan-500/10 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-foreground truncate">{email}</div>
                        <Badge variant="outline" className="border-cyan-500/30 text-cyan-200 bg-cyan-500/10">
                          {formatTier(o.override_tier)}
                        </Badge>
                        <Badge variant="outline" title={expiry.title} className="border-slate-700/60 text-muted-foreground bg-slate-900/40">
                          {expiry.short}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Applied by <span className="text-foreground">{o.created_by_display ?? 'Unknown'}</span>
                        {o.created_at ? (
                          <>
                            {' '}
                            · Applied{' '}
                            <span className="text-foreground">{new Date(o.created_at).toLocaleString()}</span>
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

