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
import { SUPPORT_EMAIL } from '@/lib/config/contact'

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

const DEMO_SOCIAL_PROOF: ReadonlyArray<{ quote: string; metric: string }> = [
  {
    quote: 'Generated 37 targeted leads and booked 3 calls in 48 hours using LeadIntel.',
    metric: '37 leads, 3 calls booked',
  },
  {
    quote: 'LeadIntel gave us send-ready outreach with why-now context on day one.',
    metric: 'First outreach campaign launched same day',
  },
]

const EXAMPLE_COMPANIES = ['HubSpot', 'Stripe', 'Shopify'] as const
const LOADING_STAGES = ['Analyzing signals...', 'Scoring leads...', 'Generating outreach...'] as const
const DEMO_USAGE_STORAGE_KEY = 'leadintel-demo-usage-v1'
const DEMO_SESSION_COOKIE = 'li_demo_session_id'
const MAX_DEMO_RUNS_PER_DAY = 2

type DemoUsageState = {
  dateKey: string
  runs: number
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const encoded = `${encodeURIComponent(name)}=`
  const parts = document.cookie.split(';').map((part) => part.trim())
  const found = parts.find((part) => part.startsWith(encoded))
  if (!found) return null
  const value = found.slice(encoded.length)
  return value.length > 0 ? decodeURIComponent(value) : null
}

function makeSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function ensureDemoSessionId(): string {
  const existing = readCookie(DEMO_SESSION_COOKIE)
  if (existing && existing.length > 0) return existing
  const created = makeSessionId()
  if (typeof document !== 'undefined') {
    document.cookie = `${encodeURIComponent(DEMO_SESSION_COOKIE)}=${encodeURIComponent(created)}; Path=/; Max-Age=2592000; SameSite=Lax`
  }
  return created
}

function readDailyUsageFromStorage(): DemoUsageState {
  const today = todayDateKey()
  if (typeof window === 'undefined') return { dateKey: today, runs: 0 }
  try {
    const raw = window.localStorage.getItem(DEMO_USAGE_STORAGE_KEY)
    if (!raw) return { dateKey: today, runs: 0 }
    const parsed = JSON.parse(raw) as { dateKey?: unknown; runs?: unknown }
    const dateKey = typeof parsed.dateKey === 'string' ? parsed.dateKey : today
    const runs = typeof parsed.runs === 'number' && Number.isFinite(parsed.runs) ? Math.max(0, Math.floor(parsed.runs)) : 0
    if (dateKey !== today) return { dateKey: today, runs: 0 }
    return { dateKey, runs }
  } catch {
    return { dateKey: today, runs: 0 }
  }
}

function persistDailyUsage(runs: number): void {
  if (typeof window === 'undefined') return
  const value: DemoUsageState = {
    dateKey: todayDateKey(),
    runs: Math.max(0, Math.floor(runs)),
  }
  window.localStorage.setItem(DEMO_USAGE_STORAGE_KEY, JSON.stringify(value))
}

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
  const [copiedShareLink, setCopiedShareLink] = useState(false)
  const [commitmentChoice, setCommitmentChoice] = useState<'yes' | 'maybe' | null>(null)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false)
  const [loadingStageIndex, setLoadingStageIndex] = useState(0)
  const [messageVariant, setMessageVariant] = useState<'default' | 'shorter' | 'aggressive'>('default')
  const [upgradePromptReason, setUpgradePromptReason] = useState<'results_loaded' | 'copy_action'>('results_loaded')
  const [checkoutNudgeDismissed, setCheckoutNudgeDismissed] = useState(false)
  const [demoRunsToday, setDemoRunsToday] = useState(0)
  const [gatingNotice, setGatingNotice] = useState<'demo_limit' | 'advanced_feature' | null>(null)
  const [handoffCompanyOrUrl, setHandoffCompanyOrUrl] = useState<string | null>(null)
  const resultCardRef = useRef<HTMLDivElement | null>(null)
  const activationTrackedRef = useRef(false)
  const handoffAutoRunRef = useRef(false)

  const remainingDemoRuns = Math.max(0, MAX_DEMO_RUNS_PER_DAY - demoRunsToday)
  const discountDeadline = useMemo(() => {
    const d = new Date()
    d.setHours(d.getHours() + 48)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }, [])
  const canSearch = useMemo(
    () => companyOrUrl.trim().length >= 2 && !loading && remainingDemoRuns > 0,
    [companyOrUrl, loading, remainingDemoRuns]
  )
  const contextualCompany = useMemo(() => {
    const fromInput = companyOrUrl.trim()
    return fromInput.length >= 2 ? fromInput : result?.company ?? ''
  }, [companyOrUrl, result])
  const shouldShowContextualCopy = useMemo(() => {
    return contextualCompany.length >= 2 && (hasUserInteracted || Boolean(handoffCompanyOrUrl))
  }, [contextualCompany, handoffCompanyOrUrl, hasUserInteracted])

  useEffect(() => {
    const usage = readDailyUsageFromStorage()
    setDemoRunsToday(usage.runs)
    ensureDemoSessionId()
    try {
      const params = new URLSearchParams(window.location.search)
      const fromQuery = params.get('company')?.trim() ?? ''
      if (fromQuery.length >= 2) {
        setCompanyOrUrl(fromQuery)
        setHasUserInteracted(true)
        setHasAutoTriggered(true)
        setHandoffCompanyOrUrl(fromQuery)
      }
    } catch {
      setHandoffCompanyOrUrl(null)
    }
  }, [])

  function trackActivation(trigger: 'copy_message' | 'add_to_campaign'): void {
    if (activationTrackedRef.current) return
    activationTrackedRef.current = true
    track('activation_completed', { source: 'demo_page', trigger })
  }

  const runSearch = useCallback(
    async (options?: { forcedCompanyOrUrl?: string; trigger?: 'manual' | 'idle_autorun' | 'query_handoff' }): Promise<void> => {
      const forcedInput = options?.forcedCompanyOrUrl?.trim() ?? ''
      const searchInput = forcedInput.length >= 2 ? forcedInput : companyOrUrl.trim().length >= 2 ? companyOrUrl.trim() : EXAMPLE_COMPANIES[0]
    if (searchInput.length < 2 || loading) return
    if (remainingDemoRuns <= 0) {
      setGatingNotice('demo_limit')
      setError("You've reached your free limit — unlock full access.")
      track('demo_free_limit_reached', { source: 'demo_page', trigger: options?.trigger ?? 'search_attempt' })
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    setHasCopiedOutreach(false)
    setCommitmentChoice(null)
    setLoadingStageIndex(0)
    activationTrackedRef.current = false
    if (forcedInput.length >= 2 || companyOrUrl.trim().length < 2) {
      setCompanyOrUrl(searchInput)
    }
    const sessionId = ensureDemoSessionId()
    track('demo_started', { source: 'demo_page', step: 'search_submitted', trigger: options?.trigger ?? 'manual' })

    try {
      const res = await fetch('/api/sample-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyOrUrl: searchInput, sessionId }),
      })
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: true
            data?: { sample?: DemoSearchResult; handoff?: { stored?: boolean }; usage?: { runsToday?: number; maxRunsPerDay?: number } }
          }
        | { ok?: false; error?: { message?: string; code?: string } }
        | null

      if (!res.ok || !json || json.ok !== true || !json.data?.sample) {
        const isUsageLimit = Boolean(json && 'error' in json && json.error?.code === 'RATE_LIMIT_EXCEEDED')
        if (isUsageLimit) {
          setGatingNotice('demo_limit')
          setError("You've reached your free limit — unlock full access.")
          setDemoRunsToday(MAX_DEMO_RUNS_PER_DAY)
          persistDailyUsage(MAX_DEMO_RUNS_PER_DAY)
          return
        }
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
      const serverRunsToday = json.data?.usage?.runsToday
      const nextRuns = typeof serverRunsToday === 'number' && Number.isFinite(serverRunsToday) ? serverRunsToday : demoRunsToday + 1
      setDemoRunsToday(nextRuns)
      persistDailyUsage(nextRuns)
      setGatingNotice(null)
    } catch {
      setError('Search failed. Try another company.')
    } finally {
      setLoading(false)
    }
    },
    [companyOrUrl, demoRunsToday, loading, remainingDemoRuns]
  )

  function handleManualSearch(): void {
    setHasUserInteracted(true)
    setHasAutoTriggered(true)
    void runSearch({ trigger: 'manual' })
  }

  function handleExamplePrefill(example: string): void {
    setHasUserInteracted(true)
    setCompanyOrUrl(example)
  }

  useEffect(() => {
    if (hasUserInteracted || hasAutoTriggered || loading || result || remainingDemoRuns <= 0) return
    const timer = window.setTimeout(() => {
      setHasAutoTriggered(true)
      setCompanyOrUrl((current) => (current.trim().length >= 2 ? current : EXAMPLE_COMPANIES[0]))
      void runSearch({ trigger: 'idle_autorun' })
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [hasAutoTriggered, hasUserInteracted, loading, remainingDemoRuns, result, runSearch])

  useEffect(() => {
    if (!handoffCompanyOrUrl) return
    if (handoffAutoRunRef.current) return
    handoffAutoRunRef.current = true
    void runSearch({ forcedCompanyOrUrl: handoffCompanyOrUrl, trigger: 'query_handoff' })
  }, [handoffCompanyOrUrl, runSearch])

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

  function openUpgradePath(source: 'first_result_cta' | 'checkout_nudge' | 'offer_banner'): void {
    track('upgrade_clicked', { source: 'demo_page', trigger: source })
    track('checkout_started', { source: 'demo_page', trigger: source })
    router.push('/pricing?target=closer')
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

  function handleMessageVariantSelection(variant: 'default' | 'shorter' | 'aggressive'): void {
    if (variant === 'default') {
      setMessageVariant('default')
      return
    }
    setGatingNotice('advanced_feature')
    setUpgradePromptReason('copy_action')
    track('demo_upgrade_triggered', { source: 'demo_page', trigger: 'advanced_feature_attempt', variant })
  }

  async function copyOutreach(): Promise<void> {
    if (!result) return
    const message = [
      computeVariantMessage(result),
      '',
      'Generated by raelinfo.com',
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

  async function copyShareLink(): Promise<void> {
    if (!result) return
    const leadId = encodeURIComponent(result.company.trim().toLowerCase().replace(/\s+/g, '-'))
    const link = `${window.location.origin}/public/lead-preview/${leadId}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedShareLink(true)
      setTimeout(() => setCopiedShareLink(false), 1800)
      track('demo_preview_share_link_copied', { source: 'demo_page', leadId })
    } catch {
      setCopiedShareLink(false)
    }
  }

  async function shareLead(): Promise<void> {
    if (!result || typeof navigator === 'undefined' || !('share' in navigator)) return
    const leadId = encodeURIComponent(result.company.trim().toLowerCase().replace(/\s+/g, '-'))
    const link = `${window.location.origin}/public/lead-preview/${leadId}`
    try {
      await navigator.share({
        title: `Lead preview: ${result.company}`,
        text: `High-intent lead found for ${result.company} on LeadIntel`,
        url: link,
      })
      track('demo_preview_shared', { source: 'demo_page', leadId })
    } catch {
      // user canceled share sheet
    }
  }

  function openSocialShare(network: 'linkedin' | 'twitter'): void {
    if (!result) return
    const leadId = encodeURIComponent(result.company.trim().toLowerCase().replace(/\s+/g, '-'))
    const previewUrl = `${window.location.origin}/public/lead-preview/${leadId}`
    const shareText = `Just found a high-intent lead: ${result.company} (${result.score}/100) using LeadIntel.`
    const url =
      network === 'linkedin'
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(previewUrl)}`
        : `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(previewUrl)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    track('demo_preview_social_share_clicked', { source: 'demo_page', network, leadId })
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
            <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              Free demo runs today: {demoRunsToday}/{MAX_DEMO_RUNS_PER_DAY}
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">Find your next leads in under a minute</h1>
          <p className="text-muted-foreground">
            Run a sample search with no login required. Preview fit, outreach, and campaign intent before signup.
          </p>
          <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Upgrade path: Free - Pro - Pro+ - Team</div>
            <div className="mt-1">
              You&apos;ve seen the value. Unlock full access now and launch daily high-intent lead generation.
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" className="neon-border hover:glow-effect" onClick={() => openUpgradePath('offer_banner')}>
                Upgrade to Pro for daily leads
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/signup?redirect=/dashboard">Sign up in under 1 minute</Link>
              </Button>
            </div>
          </div>
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
              {loading ? 'Searching...' : remainingDemoRuns > 0 ? 'Run demo lead search' : 'Unlock full access'}
            </Button>
            {loading ? (
              <div className="rounded border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-200">
                {LOADING_STAGES[loadingStageIndex]}
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">No signup required to see your first lead preview.</div>
            {remainingDemoRuns <= 0 ? (
              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">You&apos;ve reached your free limit — unlock full access.</div>
                <div className="mt-1">Upgrade to continue with 20+ daily leads and full outreach workflows.</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button asChild size="sm" className="neon-border hover:glow-effect">
                    <Link href="/pricing">Upgrade</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/signup?redirect=/demo">Sign up</Link>
                  </Button>
                </div>
              </div>
            ) : null}
            {gatingNotice === 'advanced_feature' ? (
              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">You&apos;ve reached your free limit — unlock full access.</div>
                <div className="mt-1">Advanced message controls are available with full access.</div>
              </div>
            ) : null}
            {error ? <div className="text-sm text-red-300">{error}</div> : null}
          </CardContent>
        </Card>

        {result ? (
          <Card
            ref={resultCardRef}
            className="border-cyan-400/50 bg-card/70 ring-2 ring-cyan-400/30 shadow-[0_0_30px_rgba(6,182,212,0.2)]"
          >
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-200 border-emerald-500/20">Best lead right now</Badge>
                <CardTitle className="text-lg">Step 2 - Your first result</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded border border-cyan-400/40 bg-cyan-500/10 p-4 space-y-3">
                <div className="text-lg font-semibold text-foreground">You found your first opportunities.</div>
                <p className="text-sm text-foreground">
                  Unlock the full daily pipeline for this market — 20+ fresh leads, complete outreach, and campaign tracking.
                </p>
                {shouldShowContextualCopy ? (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Showing preview opportunities for {contextualCompany}</div>
                    <div>Get daily high-intent leads like this.</div>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" className="neon-border hover:glow-effect" onClick={() => openUpgradePath('first_result_cta')}>
                    Unlock Full Pipeline
                  </Button>
                  <span className="text-xs text-muted-foreground">Leads refresh daily.</span>
                  <span className="text-xs text-muted-foreground">Preview limited to 3 leads.</span>
                </div>
              </div>

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
                    <Button type="button" variant="outline" onClick={() => handleMessageVariantSelection('shorter')}>
                      Make shorter
                    </Button>
                    <Button type="button" variant="outline" onClick={() => handleMessageVariantSelection('aggressive')}>
                      More aggressive
                    </Button>
                  </div>
                ) : null}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    onClick={() => void copyOutreach()}
                    className={`neon-border hover:glow-effect w-full sm:w-auto ${hasCopiedOutreach ? '' : 'ring-2 ring-cyan-400/40 animate-pulse'}`}
                  >
                    {copied ? <Check className="h-4 w-4 mr-2 text-green-400" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? 'Copied' : 'Copy Message'}
                  </Button>
                  <Button type="button" className="w-full sm:w-auto bg-cyan-500/15 text-cyan-100 border border-cyan-400/40 hover:bg-cyan-500/25" onClick={() => openUpgradePath('first_result_cta')}>
                    Unlock Full Pipeline
                  </Button>
                </div>
                {copied ? (
                  <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-green-200 flex flex-wrap items-center justify-between gap-2">
                    <span>Message copied — want 20 more like this?</span>
                    <Button type="button" size="sm" className="neon-border hover:glow-effect" onClick={() => openUpgradePath('checkout_nudge')}>
                      Upgrade to Pro
                    </Button>
                  </div>
                ) : null}
              </div>

              {!checkoutNudgeDismissed ? (
                <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                  <div className="text-sm font-medium text-foreground">You&apos;ve seen the value. Unlock full access now!</div>
                  <div className="text-xs text-muted-foreground">
                    Limited offer: get 20% off your first month if you upgrade in the next 48 hours (through {discountDeadline}).
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" className="neon-border hover:glow-effect" onClick={() => openUpgradePath('checkout_nudge')}>
                      Claim 20% offer
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setCheckoutNudgeDismissed(true)}>
                      Not now
                    </Button>
                  </div>
                </div>
              ) : null}

              {hasCopiedOutreach ? (
                <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                  <div className="font-medium text-foreground">Nice - you can send this right now.</div>
                  <div className="text-sm text-foreground">Message copied — want 20 more like this?</div>
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
                  <div className="text-sm text-foreground">Share this lead</div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void copyShareLink()}>
                      {copiedShareLink ? 'Link copied' : 'Copy link'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void shareLead()}>
                      Share
                    </Button>
                  </div>
                  <div className="text-sm text-foreground">Share this result</div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => openSocialShare('linkedin')}>
                      Share on LinkedIn
                    </Button>
                    <Button type="button" variant="outline" onClick={() => openSocialShare('twitter')}>
                      Share on Twitter
                    </Button>
                  </div>
                  <div className="rounded border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                    <div className="font-medium text-foreground">Invite your team</div>
                    <div className="text-xs text-muted-foreground">
                      Bring teammates into this workflow so they can help run follow-up and close faster.
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/settings/team">Invite teammates</Link>
                    </Button>
                  </div>
                  <Button
                    type="button"
                    className={`neon-border hover:glow-effect ${commitmentChoice === 'yes' ? 'ring-2 ring-emerald-400/40 animate-pulse' : ''}`}
                    onClick={() => openUpgradePath('checkout_nudge')}
                  >
                    Upgrade to Pro
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
                <div className="mt-2 text-xs text-muted-foreground">
                  Questions? <a className="text-cyan-300 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                </div>
                <div className="mt-3 rounded border border-cyan-500/20 bg-background/40 p-3 text-sm">
                  <div className="font-medium text-foreground">Invite your team</div>
                  <div className="mt-1 text-xs text-muted-foreground">Bring teammates into shared campaign execution.</div>
                  <Button asChild variant="outline" className="mt-3">
                    <Link href="/settings/team">Invite teammates</Link>
                  </Button>
                </div>
              </div>

              <div className="rounded border border-cyan-500/15 bg-card/40 p-4 space-y-3">
                <div className="text-sm font-medium text-foreground">Social proof from recent users</div>
                <div className="grid grid-cols-1 gap-2">
                  {DEMO_SOCIAL_PROOF.map((item) => (
                    <div key={item.quote} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                      <div className="text-xs text-foreground">&quot;{item.quote}&quot;</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{item.metric}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  )
}
