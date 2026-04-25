'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { track } from '@/lib/analytics'

type DemoSearchResult = {
  company: string
  score: number
  triggers: string[]
  whyNow: string
  outreach: {
    channel: 'email' | 'linkedin'
    subject?: string
    body: string
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function DemoClient() {
  const router = useRouter()
  const [companyOrUrl, setCompanyOrUrl] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DemoSearchResult | null>(null)

  const canSearch = useMemo(() => companyOrUrl.trim().length >= 2 && !loading, [companyOrUrl, loading])

  async function runSearch(): Promise<void> {
    if (!canSearch) return
    setLoading(true)
    setError(null)
    setResult(null)
    track('demo_started', { source: 'demo_page', step: 'search_submitted' })

    try {
      const res = await fetch('/api/sample-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyOrUrl: companyOrUrl.trim() }),
      })
      const json = (await res.json().catch(() => null)) as
        | { ok?: true; data?: { sample?: DemoSearchResult; handoff?: { stored?: boolean } } }
        | { ok?: false; error?: { message?: string } }
        | null

      if (!res.ok || !json || json.ok !== true || !json.data?.sample) {
        setError(json && 'error' in json ? json.error?.message ?? 'Search failed. Try another company.' : 'Search failed. Try another company.')
        return
      }

      setResult(json.data.sample)
      track('lead_search_completed', {
        source: 'demo_page',
        score: json.data.sample.score,
        companyLen: json.data.sample.company.length,
        handoffStored: Boolean(json.data.handoff?.stored),
      })
    } catch {
      setError('Search failed. Try another company.')
    } finally {
      setLoading(false)
    }
  }

  function goToSignup(): void {
    if (!isValidEmail(workEmail)) {
      setError('Enter a valid work email to continue.')
      return
    }
    track('signup_started', { source: 'demo_page', flow: 'landing_to_demo_to_signup' })
    const company = companyOrUrl.trim().length > 0 ? companyOrUrl.trim() : result?.company ?? 'acme.com'
    const redirect = `/lead-results?company=${encodeURIComponent(company)}&email=${encodeURIComponent(workEmail.trim())}`
    router.push(`/signup?redirect=${encodeURIComponent(redirect)}`)
  }

  function openLeadResultsPreview(): void {
    const company = companyOrUrl.trim().length > 0 ? companyOrUrl.trim() : result?.company ?? 'acme.com'
    track('demo_preview_opened', { source: 'demo_page', companyLen: company.length })
    router.push(`/lead-results?company=${encodeURIComponent(company)}`)
  }

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <main className="container mx-auto max-w-5xl px-4 py-12 space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              Leads refresh daily
            </Badge>
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200">
              Limited preview
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">Find your next leads in under a minute</h1>
          <p className="text-muted-foreground">
            Run a sample search with no login required. Preview fit, outreach, and campaign intent before signup.
          </p>
        </header>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Step progress</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded border border-cyan-500/20 bg-cyan-500/10 p-3">
              <div className="text-xs uppercase tracking-wide text-cyan-200">Step 1</div>
              <div className="mt-1 font-medium text-foreground">Search a target account</div>
              <div className="text-xs text-muted-foreground">No signup required</div>
            </div>
            <div className="rounded border border-cyan-500/20 bg-cyan-500/10 p-3">
              <div className="text-xs uppercase tracking-wide text-cyan-200">Step 2</div>
              <div className="mt-1 font-medium text-foreground">Preview lead quality + outreach</div>
              <div className="text-xs text-muted-foreground">Copy the AI message instantly</div>
            </div>
            <div className="rounded border border-border bg-background/40 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Step 3</div>
              <div className="mt-1 font-medium text-foreground">Unlock full campaigns</div>
              <div className="text-xs text-muted-foreground">Save leads and track execution</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Step 1 — Search a target account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo-company">Company name or website</Label>
              <Input
                id="demo-company"
                value={companyOrUrl}
                onChange={(e) => setCompanyOrUrl(e.target.value)}
                placeholder="e.g. acme.com"
                disabled={loading}
              />
            </div>
            <Button onClick={() => void runSearch()} disabled={!canSearch} className="neon-border hover:glow-effect">
              {loading ? 'Searching…' : 'Run demo lead search'}
            </Button>
            <div className="text-xs text-muted-foreground">No signup required to see your first lead preview.</div>
            {error ? <div className="text-sm text-red-300">{error}</div> : null}
          </CardContent>
        </Card>

        {result ? (
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Step 2 — Partial results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded border border-cyan-500/10 bg-background/40 p-4 text-sm space-y-2">
                <div>
                  <span className="text-muted-foreground">Company:</span> <span className="font-medium">{result.company}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Lead score:</span> <span className="font-medium">{result.score}/100</span>
                </div>
                <div>
                  <div className="text-muted-foreground">Why this lead is a good fit:</div>
                  <div className="text-foreground">{result.whyNow}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Top signals:</div>
                  <ul className="list-disc pl-5">
                    {result.triggers.slice(0, 2).map((signal) => (
                      <li key={signal}>{signal}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded border border-cyan-500/10 bg-card/50 p-3 text-muted-foreground">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">AI-generated outreach message</div>
                  {result.outreach.subject ? (
                    <div className="mt-2 text-foreground text-sm">
                      <span className="font-medium">Subject:</span> {result.outreach.subject}
                    </div>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm">{result.outreach.body}</p>
                </div>
              </div>

              <div className="rounded border border-cyan-500/20 bg-cyan-500/10 p-4">
                <div className="font-medium text-foreground">Want to see all matched leads?</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open your limited preview now. Leads refresh daily and only a small set is visible before upgrade.
                </p>
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <Button onClick={openLeadResultsPreview} className="neon-border hover:glow-effect">
                    View lead results
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/pricing">See upgrade options</Link>
                  </Button>
                </div>
              </div>

              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="font-medium">Unlock full lead details and outreach drafts</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Continue with your work email to save results and access the dashboard.
                </p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <Input
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    placeholder="you@company.com"
                    inputMode="email"
                  />
                  <Button onClick={goToSignup} className="neon-border hover:glow-effect">
                    Continue to signup
                  </Button>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <Link
                    href={`/login?mode=signin&redirect=${encodeURIComponent(
                      `/lead-results?company=${encodeURIComponent(
                        companyOrUrl.trim().length > 0 ? companyOrUrl.trim() : result?.company ?? 'acme.com'
                      )}&email=${encodeURIComponent(workEmail.trim())}`
                    )}`}
                    className="text-cyan-300 hover:underline"
                  >
                    Log in
                  </Link>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Prefer to review plans first?{' '}
                  <Link
                    href="/pricing"
                    onClick={() => track('checkout_started', { source: 'demo_page_paywall', stage: 'pricing_intent' })}
                    className="text-cyan-300 hover:underline"
                  >
                    See pricing
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  )
}
