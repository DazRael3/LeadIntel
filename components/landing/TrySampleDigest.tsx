'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { track } from '@/lib/analytics'
import { COPY } from '@/lib/copy/leadintel'

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

export function TrySampleDigest() {
  const [companyOrUrl, setCompanyOrUrl] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [emailMe, setEmailMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ title: string; body: string } | null>(null)
  const [result, setResult] = useState<ApiOk['data'] | null>(null)

  const canSubmit = useMemo(() => companyOrUrl.trim().length >= 2 && !loading, [companyOrUrl, loading])
  async function onGenerate() {
    if (!canSubmit) return
    const trimmed = companyOrUrl.trim()
    const email = workEmail.trim()
    const wantsEmail = emailMe

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
    })
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
        setError({ title: COPY.validation.invalidCompanyOrUrl, body: COPY.validation.invalidCompanyOrUrl })
        return
      }

      setResult(payload.data)
      track('landing_sample_generated', { score: payload.data.sample.score })
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
            placeholder="e.g., acme.com or Acme"
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
            disabled={loading || !emailMe}
            className="bg-background"
          />
        </div>

        <div className="flex items-start gap-3">
          <input
            id="email_me"
            type="checkbox"
            checked={emailMe}
            onChange={(e) => setEmailMe(e.target.checked)}
            disabled={loading}
            className="mt-1 h-4 w-4 accent-cyan-400"
          />
          <div className="flex-1">
            <Label htmlFor="email_me">{COPY.home.trySample.checkboxLabel}</Label>
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

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {COPY.home.trySample.upsellLine}
              </div>
              <Button asChild size="sm" className="neon-border hover:glow-effect">
                <Link href="/signup?redirect=/onboarding" onClick={() => track('cta_signup_clicked', { source: 'sample_upsell' })}>
                  {COPY.home.trySample.upsellCta}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

