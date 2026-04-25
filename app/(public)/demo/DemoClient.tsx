'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Check } from 'lucide-react'
import { track } from '@/lib/analytics'

type DemoSearchResult = {
  company: string
  score: number
  triggers: string[]
  scoreFactors: string[]
  whyNow: string
  updatedAt: string
  outreach: {
    channel: 'email' | 'linkedin'
    subject?: string
    body: string
  }
}

const EXAMPLE_COMPANIES = ['HubSpot', 'Stripe', 'Shopify'] as const
const LOADING_STAGES = ['Analyzing signals...', 'Scoring leads...', 'Generating outreach...'] as const

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function DemoClient() {
  const router = useRouter()
  const [companyOrUrl, setCompanyOrUrl] = useState<string>(EXAMPLE_COMPANIES[0])
  const [workEmail, setWorkEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DemoSearchResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [hasCopiedOutreach, setHasCopiedOutreach] = useState(false)
  const [commitmentChoice, setCommitmentChoice] = useState<'yes' | 'maybe' | null>(null)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false)
  const [loadingStageIndex, setLoadingStageIndex] = useState(0)
  const [messageVariant, setMessageVariant] = useState<'default' | 'shorter' | 'aggressive'>('default')
  const [upgradePromptReason, setUpgradePromptReason] = useState<'results_loaded' | 'copy_action'>('results_loaded')
  const resultCardRef = useRef<HTMLDivElement | null>(null)
  const activationTrackedRef = useRef(false)

  const canSearch = useMemo(() => companyOrUrl.trim().length >= 2 && !loading, [companyOrUrl, loading])

  function trackActivation(trigger: 'copy_message' | 'add_to_campaign'): void {
    if (activationTrackedRef.current) return
    activationTrackedRef.current = true
    track('activation_completed', { source: 'demo_page', trigger })
  }

  const runSearch = useCallback(async (): Promise<void> => {
    const searchInput = companyOrUrl.trim().length >= 2 ? companyOrUrl.trim() : EXAMPLE_COMPANIES[0]
    if (searchInput.length < 2 || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setHasCopiedOutreach(false)
    setCommitmentChoice(null)
    setLoadingStageIndex(0)
    activationTrackedRef.current = false
    if (companyOrUrl.trim().length < 2) {
      setCompanyOrUrl(searchInput)
    }
    track('demo_started', { source: 'demo_page', step: 'search_submitted' })

    try {
      const res = await fetch('/api/sample-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyOrUrl: searchInput }),
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
      setUpgradePromptReason('results_loaded')
      track('lead_search_completed', {
        source: 'demo_page',
        score: json.data.sample.score,
        companyLen: json.data.sample.company.length,
        handoffStored: Boolean(json.data.handoff?.stored),
      })
      track('results_viewed', {
        source: 'demo_page',
        surface: 'demo_results',
        companyLen: json.data.sample.company.length,
      })
    } catch {
      setError('Search failed. Try another company.')
    } finally {
      setLoading(false)
    }
  }, [companyOrUrl, loading])

  function handleManualSearch(): void {
    setHasUserInteracted(true)
    setHasAutoTriggered(true)
    void runSearch()
  }

  function handleExamplePrefill(example: string): void {
    setHasUserInteracted(true)
    setCompanyOrUrl(example)
  }

  useEffect(() => {
    if (hasUserInteracted || hasAutoTriggered || loading || result) return
    const timer = window.setTimeout(() => {
      setHasAutoTriggered(true)
      setCompanyOrUrl((current) => (current.trim().length >= 2 ? current : EXAMPLE_COMPANIES[0]))
      void runSearch()
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [hasAutoTriggered, hasUserInteracted, loading, result, runSearch])

  useEffect(() => {
    if (!loading) {
      setLoadingStageIndex(0)
      return
    }
    const interval = window.setInterval(() => {
      setLoadingStageIndex((current) => Math.min(current + 1, LOADING_STAGES.length - 1))
    }, 900)
    return () => window.clearInterval(interval)
  }, [loading])

  useEffect(() => {
    if (!result) return
    resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [result])

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
    track('results_viewed', { source: 'demo_page', surface: 'lead_results_preview_opened', companyLen: company.length })
    router.push(`/lead-results?company=${encodeURIComponent(company)}`)
  }

  function formatRecent(value: string): string {
    const ms = Date.parse(value)
    if (!Number.isFinite(ms)) return 'Updated recently'
    const mins = Math.max(1, Math.round((Date.now() - ms) / 60000))
    if (mins < 60) return `Updated ${mins}m ago`
    const hours = Math.round(mins / 60)
    if (hours < 24) return `Updated ${hours}h ago`
    return `Updated ${Math.round(hours / 24)}d ago`
  }

  function selectMessageBase(current: DemoSearchResult): string {
    const parts = [current.outreach.subject ? `Subject: ${current.outreach.subject}` : null, current.outreach.body]
      .filter((line): line is string => Boolean(line))
    return parts.join('\n\n')
  }

  function computeVariantMessage(current: DemoSearchResult): string {
    const base = selectMessageBase(current)
    const triggerSignal = current.triggers[0] ?? 'recent activity'
    if (messageVariant === 'shorter') {
      return `Noticed ${triggerSignal.toLowerCase()} at ${current.company}. Worth a quick 10-minute intro this week?`
    }
    if (messageVariant === 'aggressive') {
      return `Saw ${triggerSignal.toLowerCase()} at ${current.company}. If this is a priority this quarter, let's lock a quick call and I’ll show exactly how similar teams converted that signal into meetings.`
    }
    return base
  }

  async function copyOutreach(): Promise<void> {
    if (!result) return
    const message = [
      computeVariantMessage(result),
      '',
      'Generated with RaelInfo',
      'https://raelinfo.com',
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setHasCopiedOutreach(true)
      setUpgradePromptReason('copy_action')
      trackActivation('copy_message')
      setTimeout(() => setCopied(false), 1800)
      track('demo_preview_outreach_copied', { source: 'demo_page', companyLen: result.company.length })
    } catch {
      setCopied(false)
    }
  }

  function handleCampaignHook(): void {
    if (!result) return
    setUpgradePromptReason('copy_action')
    trackActivation('add_to_campaign')
    track('demo_preview_add_to_campaign_clicked', { source: 'demo_page_post_copy', companyLen: result.company.length })
    openLeadResultsPreview()
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
          <CardContent className="py-4 text-sm">
            <div className="grid gap-1 text-muted-foreground">
              <div>Step 1: Find leads {result ? '(done)' : ''}</div>
              <div>Step 2: Copy outreach {hasCopiedOutreach ? '(done)' : ''}</div>
              <div>Step 3: Send or track</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Step 1 - Search a target account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo-company">Company name or website</Label>
              <Input
                id="demo-company"
                value={companyOrUrl}
                onChange={(e) => {
                  setHasUserInteracted(true)
                  setCompanyOrUrl(e.target.value)
                }}
                placeholder="Try: HubSpot, Stripe, Shopify"
                disabled={loading}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_COMPANIES.map((example) => (
                <Button
                  key={example}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleExamplePrefill(example)}
                  disabled={loading}
                >
                  {example}
                </Button>
              ))}
            </div>
            <Button onClick={handleManualSearch} disabled={!canSearch} className="neon-border hover:glow-effect">
              {loading ? 'Searching...' : 'Run demo lead search'}
            </Button>
            {loading ? (
              <div className="rounded border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-200">
                {LOADING_STAGES[loadingStageIndex]}
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">No signup required to see your first lead preview.</div>
            {error ? <div className="text-sm text-red-300">{error}</div> : null}
          </CardContent>
        </Card>

        {result ? (
          <Card ref={resultCardRef} className="border-cyan-500/30 bg-card/60 shadow-[0_0_0_1px_rgba(6,182,212,0.25)]">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-200 border-emerald-500/20">Best lead right now</Badge>
                <CardTitle className="text-lg">Step 2 - Your first result</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded border border-cyan-500/20 bg-background/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-foreground">{result.company}</div>
                  <Badge className="bg-cyan-500/10 text-cyan-200 border-cyan-500/20 animate-pulse">{result.score}/100</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{formatRecent(result.updatedAt)}</div>
                <div className="text-sm">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Why this lead now</div>
                  <p className="mt-1 text-foreground line-clamp-2">{result.whyNow}</p>
                </div>
                <div className="text-sm">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Based on</div>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {(result.scoreFactors ?? []).slice(0, 3).map((factor) => (
                      <li key={factor}>{factor}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded border border-cyan-500/10 bg-card/50 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Suggested outreach</div>
                  {messageVariant === 'default' && result.outreach.subject ? (
                    <div className="mt-2 text-sm text-foreground">
                      <span className="font-medium">Subject:</span> {result.outreach.subject}
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-4">{computeVariantMessage(result)}</p>
                </div>
                {!hasCopiedOutreach ? <div className="text-xs text-muted-foreground">Primary action: copy this outreach to use it right now.</div> : null}
                {hasCopiedOutreach ? (
                  <div className="flex flex-wrap gap-2 opacity-85">
                    <Button type="button" variant="outline" onClick={() => setMessageVariant('default')}>
                      Regenerate
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setMessageVariant('shorter')}>
                      Make shorter
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setMessageVariant('aggressive')}>
                      More aggressive
                    </Button>
                  </div>
                ) : null}
                <Button
                  type="button"
                  onClick={() => void copyOutreach()}
                  className={`neon-border hover:glow-effect w-full sm:w-auto ${hasCopiedOutreach ? '' : 'ring-2 ring-cyan-400/40 animate-pulse'}`}
                >
                  {copied ? <Check className="h-4 w-4 mr-2 text-green-400" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Copied' : 'Copy Message'}
                </Button>
                {copied ? <div className="text-xs text-green-300">Message copied.</div> : null}
              </div>

              {hasCopiedOutreach ? (
                <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                  <div className="font-medium text-foreground">Nice - you can send this right now.</div>
                  <div className="text-sm text-foreground">Want 50 more like this?</div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>- Message copied</li>
                    <li>- Ready to send</li>
                    <li>- Based on real signals</li>
                  </ul>
                  <div className="text-sm text-foreground">Would you send this?</div>
                  <div className="flex gap-2">
                    <Button type="button" variant={commitmentChoice === 'yes' ? 'default' : 'outline'} onClick={() => setCommitmentChoice('yes')}>
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant={commitmentChoice === 'maybe' ? 'default' : 'outline'}
                      onClick={() => setCommitmentChoice('maybe')}
                    >
                      Maybe
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">Save this lead to track outreach?</div>
                  <Button type="button" variant="outline" onClick={handleCampaignHook}>
                    Add to Campaign
                  </Button>
                  <Button asChild className={`neon-border hover:glow-effect ${commitmentChoice === 'yes' ? 'ring-2 ring-emerald-400/40 animate-pulse' : ''}`}>
                    <Link href="/pricing">Unlock Full Pipeline</Link>
                  </Button>
                </div>
              ) : null}

              <div className="rounded border border-cyan-500/20 bg-cyan-500/10 p-4">
                <div className="text-xs uppercase tracking-wide text-cyan-200">Step 3 of 3</div>
                <div className="mt-2 font-semibold text-foreground">You&apos;ve unlocked 3 high-quality leads.</div>
                <p className="mt-1 text-sm text-foreground">These companies are actively growing and hiring.</p>
                <div className="mt-3 text-sm text-muted-foreground">
                  {upgradePromptReason === 'copy_action'
                    ? "You've already found and copied a high-intent lead message - don't lose momentum now."
                    : "You've already found high-intent leads in minutes - don't lose momentum now."}{' '}
                  Unlock 50+ more leads with no manual research.
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <li>- 50+ similar leads</li>
                  <li>- Full contact data</li>
                  <li>- AI outreach sequences</li>
                  <li>- Daily new opportunities</li>
                </ul>
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <Button asChild className="neon-border hover:glow-effect">
                    <Link href="/pricing">Unlock All Leads</Link>
                  </Button>
                  <Button onClick={openLeadResultsPreview} variant="outline">
                    View lead results
                  </Button>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Leads refresh daily | Cancel anytime</div>
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
