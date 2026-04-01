'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { track } from '@/lib/analytics'
import { COPY } from '@/lib/copy/leadintel'
import { createClient } from '@/lib/supabase/client'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { parseTarget } from '@/lib/onboarding/targets'

type ApiOk = {
  ok: true
  data: {
    sample: {
      company: string
      score: number
      triggers: string[]
      whyNow: string
      outreach: { channel: 'email' | 'linkedin'; subject?: string; body: string }
      disclaimer: string
    }
    email: { requested: boolean; sent: boolean; reason?: string }
  }
}

type ApiErr = { ok: false; error?: { message?: string } }
type ApiEnvelope = ApiOk | ApiErr

const EMAIL_CONFIG_CACHE_KEY = 'li_email_config_v1'
const EMAIL_CONFIG_CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

type EmailConfigCache = { enabled: boolean; ts: number }

function loadEmailConfigCache(): EmailConfigCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(EMAIL_CONFIG_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as Record<string, unknown>
    const enabled = obj.enabled
    const ts = obj.ts
    if (typeof enabled !== 'boolean') return null
    if (typeof ts !== 'number' || !Number.isFinite(ts)) return null
    if (Date.now() - ts > EMAIL_CONFIG_CACHE_TTL_MS) return null
    return { enabled, ts }
  } catch {
    return null
  }
}

function saveEmailConfigCache(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EMAIL_CONFIG_CACHE_KEY, JSON.stringify({ enabled, ts: Date.now() } satisfies EmailConfigCache))
  } catch {
    // ignore
  }
}

function getDeviceClass(): 'mobile' | 'desktop' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown'
  const w = window.innerWidth
  if (!Number.isFinite(w)) return 'unknown'
  return w < 768 ? 'mobile' : 'desktop'
}

export function TrySampleDigest() {
  const [companyOrUrl, setCompanyOrUrl] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [emailMe, setEmailMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ title: string; body: string } | null>(null)
  const [result, setResult] = useState<ApiOk['data'] | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [tracking, setTracking] = useState(false)
  const [tracked, setTracked] = useState(false)
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null)
  const [usageTier, setUsageTier] = useState<string | null>(null)
  const [emailConfigured, setEmailConfigured] = useState(false)

  const canSubmit = useMemo(() => companyOrUrl.trim().length >= 2 && !loading, [companyOrUrl, loading])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    void (async () => {
      const user = await getUserSafe(supabase)
      if (cancelled) return
      setAuthed(Boolean(user))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadUsage = async () => {
      try {
        const res = await fetch('/api/usage/premium-generations', { method: 'GET', cache: 'no-store', credentials: 'include' })
        if (!res.ok) return
        const json = (await res.json()) as { ok?: boolean; data?: { capabilities?: { tier?: string }; usage?: { used: number; limit: number; remaining: number } } }
        if (!json?.ok) return
        if (cancelled) return
        const u = json.data?.usage ?? null
        if (u) setUsage(u)
        setUsageTier(typeof json.data?.capabilities?.tier === 'string' ? json.data?.capabilities?.tier : null)
      } catch {
        // ignore
      }
    }
    if (authed) void loadUsage()
    return () => {
      cancelled = true
    }
  }, [authed])

  useEffect(() => {
    let cancelled = false
    const loadEmailConfig = async () => {
      try {
        const cached = loadEmailConfigCache()
        if (cached) {
          setEmailConfigured(cached.enabled)
          return
        }

        const res = await fetch('/api/public/email-config', { method: 'GET', cache: 'force-cache' })
        if (!res.ok) return
        const json = (await res.json()) as { ok?: boolean; data?: { enabled?: boolean } }
        if (!json?.ok) return
        if (cancelled) return
        const enabled = Boolean(json.data?.enabled)
        setEmailConfigured(enabled)
        saveEmailConfigCache(enabled)
      } catch {
        // ignore
      }
    }
    void loadEmailConfig()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!emailConfigured && emailMe) setEmailMe(false)
  }, [emailConfigured, emailMe])

  async function trackThisAccount() {
    if (!result) return
    if (authed !== true) {
      const redirect = `/onboarding?from=sample&company=${encodeURIComponent(companyOrUrl.trim() || result.sample.company)}`
      window.location.href = `/signup?redirect=${encodeURIComponent(redirect)}`
      return
    }

    setTracking(true)
    try {
      const supabase = createClient()
      const user = await getUserSafe(supabase)
      if (!user) {
        const redirect = `/onboarding?from=sample&company=${encodeURIComponent(companyOrUrl.trim() || result.sample.company)}`
        window.location.href = `/login?mode=signin&redirect=${encodeURIComponent(redirect)}`
        return
      }

      const parsed = parseTarget(companyOrUrl.trim() || result.sample.company)
      const row =
        parsed && parsed.domain
          ? { user_id: user.id, company_domain: parsed.domain, company_url: parsed.url, company_name: null, ai_personalized_pitch: null }
          : { user_id: user.id, company_domain: null, company_url: null, company_name: result.sample.company, ai_personalized_pitch: null }

      const { error: upsertError } = await supabase.from('leads').upsert([row], { onConflict: 'user_id,company_domain' })
      if (!upsertError) {
        setTracked(true)
        track('first_account_tracked', { source: 'sample_digest' })
      }
    } finally {
      setTracking(false)
    }
  }

  async function onGenerate() {
    if (!canSubmit) return
    const parsedTarget = parseTarget(companyOrUrl)
    if (!parsedTarget) {
      setError({
        title: 'Enter a company name or website.',
        body: 'Try a company name like Google, or a website like google.com.',
      })
      return
    }
    const trimmed = parsedTarget.name
    const email = workEmail.trim()
    const wantsEmail = emailMe && emailConfigured
    const deviceClass = getDeviceClass()
    const host = typeof window !== 'undefined' ? window.location.host : 'unknown'

    if (wantsEmail && !email) {
      setError({ title: COPY.validation.required, body: COPY.validation.required })
      return
    }
    if (wantsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError({ title: COPY.validation.invalidEmail, body: COPY.validation.invalidEmail })
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    track('landing_try_sample_submitted', {
      hasEmailRequested: wantsEmail,
      inputLen: trimmed.length,
      inputHasDot: trimmed.includes('.'),
      deviceClass,
      host,
    })
    track('sample_started', { source: 'landing_try_sample' })
    if (wantsEmail) track('landing_sample_email_requested')

    try {
      const res = await fetch('/api/sample-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyOrUrl: trimmed,
          email: wantsEmail ? email : undefined,
          emailMe: wantsEmail,
        }),
      })

      const rawText = await res.text().catch(() => '')
      const payload: ApiEnvelope | null = rawText ? (JSON.parse(rawText) as ApiEnvelope) : null

      if (!res.ok || !payload || payload.ok !== true) {
        if (res.status === 429) {
          setError({ title: COPY.rateLimit.title, body: COPY.rateLimit.body })
          return
        }
        const serverMsg =
          payload && payload.ok === false && typeof payload.error?.message === 'string' ? payload.error.message : null
        setError({
          title: 'Enter a company name or website.',
          body: serverMsg || 'Try a company name like Google, or a website like google.com.',
        })
        return
      }

      setResult(payload.data)
      track('landing_sample_generated', { score: payload.data.sample.score, deviceClass, host })
      track('sample_completed', { score: payload.data.sample.score })
      if (payload.data.email.requested && payload.data.email.sent) {
        track('landing_sample_email_sent')
      }
    } catch {
      setError({ title: COPY.errors.requestFailed.title, body: COPY.errors.requestFailed.body })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{COPY.home.trySample.sectionTitle}</CardTitle>
        <p className="text-xs text-muted-foreground">{COPY.home.trySample.helper}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sample_company">{COPY.home.trySample.companyLabel}</Label>
          <Input
            id="sample_company"
            value={companyOrUrl}
            onChange={(e) => setCompanyOrUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void onGenerate()
              }
            }}
            placeholder="e.g., acme.com or Acme"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={loading}
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sample_email">{COPY.home.trySample.emailLabel}</Label>
          <Input
            id="sample_email"
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={loading || !emailMe || !emailConfigured}
            className="bg-background"
          />
        </div>

        <div className="flex items-start gap-3">
          <input
            id="email_me"
            type="checkbox"
            checked={emailMe}
            onChange={(e) => setEmailMe(e.target.checked)}
            disabled={loading || !emailConfigured}
            className="mt-1 h-4 w-4 accent-cyan-400"
          />
          <div className="flex-1">
            <Label htmlFor="email_me">{COPY.home.trySample.checkboxLabel}</Label>
            {!emailConfigured ? (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Email delivery isn’t enabled for this environment yet.
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={onGenerate} disabled={!canSubmit} className="neon-border hover:glow-effect">
            {loading ? 'Generating…' : COPY.home.trySample.button}
          </Button>
          <Button asChild variant="outline" disabled={loading}>
            <Link href="/pricing" onClick={() => track('pricing_cta_clicked', { source: 'sample_widget' })}>
              {COPY.home.hero.secondaryCta}
            </Link>
          </Button>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-3">
            <p className="font-medium">{error.title}</p>
            <p className="mt-1">{error.body}</p>
            {error.title === COPY.rateLimit.title ? (
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={onGenerate}>
                  {COPY.rateLimit.cta}
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="rounded border border-cyan-500/20 bg-background/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-foreground">
                  {COPY.home.trySample.resultsTitle(result.sample.company)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Lead score: <span className="font-semibold text-foreground">{result.sample.score}/100</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-medium text-foreground">Trigger signals</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {result.sample.triggers.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <div className="text-xs font-medium text-foreground">Why now</div>
                <p className="mt-2 text-sm text-muted-foreground">{result.sample.whyNow}</p>
              </div>

              <div className="mt-4">
                <div className="text-xs font-medium text-foreground">Outreach draft ({result.sample.outreach.channel})</div>
                {result.sample.outreach.subject && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Subject:</span> {result.sample.outreach.subject}
                  </div>
                )}
                <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground rounded border border-cyan-500/20 bg-black/20 p-3">
                  {result.sample.outreach.body}
                </pre>
                <div className="mt-2 text-[11px] text-muted-foreground">{result.sample.disclaimer}</div>
              </div>

              {result.email.requested && !result.email.sent && (
                <div className="mt-4 text-xs text-muted-foreground border-t border-cyan-500/10 pt-3">
                  Email sending isn’t enabled yet — here’s your sample on screen.
                </div>
              )}
              {result.email.requested && result.email.sent && (
                <div className="mt-4 text-xs text-muted-foreground border-t border-cyan-500/10 pt-3">
                  Sent to your email.
                </div>
              )}
            </div>

            <div className="rounded border border-cyan-500/20 bg-card/40 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">What you just saw</div>
                {authed && usageTier === 'starter' && usage ? (
                  <div className="text-xs text-muted-foreground">
                    Usage remaining: <span className="text-foreground font-medium">{usage.remaining}</span> / {usage.limit}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Why this was prioritized</div>
                  <div className="mt-2">{result.sample.whyNow}</div>
                </div>
                <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">What the score is based on</div>
                  <div className="mt-2">
                    Deterministic fit + signal recency + signal strength. No black-box ranking.
                  </div>
                  <div className="mt-2">
                    <Link className="text-cyan-400 hover:underline" href="/how-scoring-works">
                      Review scoring method
                    </Link>
                  </div>
                </div>
                <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">What gets unlocked in paid plans</div>
                  <div className="mt-2">
                    Full saved outputs, richer account workspace context, and action packaging (briefs, exports, webhooks).
                  </div>
                </div>
                <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">What to do next</div>
                  <div className="mt-2">
                    Track the account, generate another preview, then use the action center while timing is fresh.
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  className="neon-border hover:glow-effect"
                  onClick={() => {
                    track('sample_restart_clicked', { source: 'sample_digest_next_steps' })
                    setResult(null)
                    setTracked(false)
                  }}
                >
                  Generate another preview
                </Button>
                <Button size="sm" variant="outline" disabled={tracking || tracked} onClick={() => void trackThisAccount()}>
                  {tracked ? 'Tracked' : tracking ? 'Tracking…' : 'Track this account'}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/pricing" onClick={() => track('homepage_cta_pricing_clicked', { source: 'sample_next_steps' })}>
                    View pricing
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/how-scoring-works" onClick={() => track('first_scoring_explainer_viewed', { source: 'sample_next_steps' })}>
                    Review scoring method
                  </Link>
                </Button>
              </div>

              {authed !== true ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-cyan-500/10">
                  <div className="text-sm text-muted-foreground">{COPY.home.trySample.upsellLine}</div>
                  <Button
                    asChild
                    size="sm"
                    className="neon-border hover:glow-effect"
                    onClick={() => track('cta_signup_clicked', { source: 'sample_next_steps' })}
                  >
                    <Link
                      href={`/signup?redirect=${encodeURIComponent(
                        `/onboarding?from=sample&company=${encodeURIComponent(companyOrUrl.trim() || result.sample.company)}`
                      )}`}
                    >
                      {COPY.home.trySample.upsellCta}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

