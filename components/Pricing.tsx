'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Zap, Shield, TrendingUp, Loader2, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { usePlan } from "@/components/PlanProvider"
import { formatErrorMessage } from "@/lib/utils/format-error"
import { track } from '@/lib/analytics'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { COPY } from '@/lib/copy/leadintel'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { OutcomePricingIntro } from '@/components/marketing/OutcomePricingIntro'
import { AuthedSettingsStamp } from '@/components/marketing/AuthedSettingsStamp'

type PaidPlanId = 'pro' | 'closer_plus' | 'team'
type BillingCycle = 'monthly' | 'annual'

const PRICING = {
  closerMonthly: 79,
  closerPlusMonthly: 149,
  teamBaseMonthly: 249,
  teamSeatMonthly: 49,
} as const

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function annualFromMonthly(monthly: number): number {
  // Professional default: “save 2 months” = pay for 10 months.
  return monthly * 10
}

/**
 * Safely parses JSON, returning null if parsing fails
 */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Extracts a user-friendly error message from API error responses.
 * Handles the standardized error envelope: { ok: false, error: { code, message } }
 */
function extractApiErrorMessage(payload: unknown): string {
  // Handle null/undefined
  if (payload == null) {
    return 'An unknown error occurred'
  }
  
  // Handle string error
  if (typeof payload === 'string') {
    return payload.length > 200 ? `${payload.substring(0, 197)}...` : payload
  }
  
  // Handle our standardized error envelope: { ok: false, error: { code, message } }
  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    
    // Check for error.message (our standard format)
    if (obj.error && typeof obj.error === 'object') {
      const err = obj.error as Record<string, unknown>
      if (typeof err.message === 'string') {
        return err.message
      }
    }

    // If Stripe checkout failed, surface safe Stripe hints when provided.
    if (obj.error && typeof obj.error === 'object') {
      const err = obj.error as { code?: unknown; details?: unknown; requestId?: unknown }
      const code = typeof err.code === 'string' ? err.code : null
      if (code === 'EXTERNAL_API_ERROR' && err.details && typeof err.details === 'object') {
        const details = err.details as { stripeCode?: unknown; stripeType?: unknown; debugMessage?: unknown }
        const debugMessage = typeof details.debugMessage === 'string' ? details.debugMessage : null
        if (debugMessage && debugMessage.trim().length > 0) {
          return debugMessage
        }
        const stripeCode = typeof details.stripeCode === 'string' ? details.stripeCode : null
        const stripeType = typeof details.stripeType === 'string' ? details.stripeType : null
        if (stripeCode || stripeType) {
          const hint = stripeCode ? `Stripe error: ${stripeCode}` : stripeType ? `Stripe error: ${stripeType}` : ''
          return hint || 'Stripe checkout failed'
        }
      }
    }
    
    // Check for direct message property
    if (typeof obj.message === 'string') {
      return obj.message
    }
    
    // Fallback to formatErrorMessage for other object shapes
    return formatErrorMessage(payload)
  }
  
  return 'An unexpected error occurred'
}

/**
 * Checks if an error message contains Stripe configuration hints
 */
function isStripeConfigError(message: string): boolean {
  if (typeof message !== 'string') return false
  const lowerMessage = message.toLowerCase()
  return lowerMessage.includes('stripe_price_id') || 
         lowerMessage.includes('price_') ||
         lowerMessage.includes('stripe configuration') ||
         lowerMessage.includes('invalid stripe configuration')
}

export function Pricing() {
  const router = useRouter()
  const [target, setTarget] = useState<string | null>(null) // optional: closer
  const supabase = createClient()
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const { isPro, isHouseCloserOverride } = usePlan()
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [teamSeats, setTeamSeats] = useState<number>(5)
  const upgradeRef = useRef<HTMLDivElement | null>(null)

  const closerPrice = billingCycle === 'annual' ? annualFromMonthly(PRICING.closerMonthly) : PRICING.closerMonthly
  const closerPlusPrice =
    billingCycle === 'annual' ? annualFromMonthly(PRICING.closerPlusMonthly) : PRICING.closerPlusMonthly
  const teamBasePrice = billingCycle === 'annual' ? annualFromMonthly(PRICING.teamBaseMonthly) : PRICING.teamBaseMonthly
  const teamSeatPrice = billingCycle === 'annual' ? annualFromMonthly(PRICING.teamSeatMonthly) : PRICING.teamSeatMonthly
  const cadenceLabel = billingCycle === 'annual' ? '/year' : '/month'
  const pricingViewedAt = useMemo(() => new Date().toISOString(), [])

  useEffect(() => {
    // Client-only query parsing (avoid useSearchParams() suspense requirement during prerender).
    try {
      const qs = new URLSearchParams(window.location.search)
      const t = qs.get('target')
      setTarget(t)
    } catch {
      setTarget(null)
    }
  }, [])

  useEffect(() => {
    // Default behavior: paid users are sent to dashboard.
    if (isPro) {
      router.replace('/dashboard')
    }
  }, [isPro, router, target])

  useEffect(() => {
    if (!target) return
    const id =
      target === 'closer'
        ? 'plan-closer'
        : target === 'closer_plus'
          ? 'plan-closer-plus'
          : target === 'team'
            ? 'plan-team'
            : null
    if (!id) return
    // Let layout settle before scrolling.
    const t = setTimeout(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return () => clearTimeout(t)
  }, [target])

  useEffect(() => {
    const el = upgradeRef.current
    if (!el) return
    let fired = false
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (fired) return
        fired = true
        track('pricing_upgrade_section_viewed', { section: 'why_teams_upgrade' })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const handleCheckout = async (planId: PaidPlanId) => {
    setIsCheckoutLoading(true)
    setCheckoutError(null)
    
    try {
      track('pricing_cta_clicked', { source: 'pricing', planId })
      track('upgrade_clicked', { source: 'pricing', planId, billingCycle, seats: planId === 'team' ? teamSeats : undefined })
      // Check authentication before calling /api/checkout
      const user = await getUserSafe(supabase)
      if (!user) {
        // Not authenticated - redirect to login
        router.push('/login?mode=signin&redirect=/pricing')
        return
      }

      // User is authenticated - proceed with checkout
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          billingCycle,
          seats: planId === 'team' ? teamSeats : undefined,
        }),
      })

      // Parse response safely: read as text, then JSON.parse if present.
      const raw = await response.text()
      const payload = raw.trim().length > 0 ? safeJsonParse(raw) : null

      // Handle error responses
      if (!response.ok) {
        // 401 -> redirect to login
        if (response.status === 401) {
          router.push('/login?mode=signin&redirect=/pricing')
          return
        }
        
        // 409 -> already subscribed
        if (response.status === 409) {
          router.replace('/dashboard')
          return
        }
        
        // Extract a meaningful error message.
        const errorMessage =
          extractApiErrorMessage(payload) ||
          (raw.trim().length > 0 ? raw : `Checkout failed (${response.status})`)
        console.error('[Pricing] Checkout failed:', { status: response.status, message: errorMessage })
        // User-friendly message (do not leak internals).
        // If it's a configuration issue, we can surface an actionable message safely
        // because the server returns only missing env var *names* (never values).
        const maybeCode =
          payload && typeof payload === 'object'
            ? (payload as { error?: { code?: unknown } }).error?.code
            : undefined
        const code = typeof maybeCode === 'string' ? maybeCode : null
        const showActionable =
          response.status === 500 &&
          (code === 'CHECKOUT_NOT_CONFIGURED' ||
            errorMessage.toLowerCase().includes('checkout is not configured') ||
            isStripeConfigError(errorMessage))
        // Owner debugging: if you're using the House Closer override, show safe error details
        // (Stripe code/type/request id) so you can fix config quickly.
        const requestId =
          payload && typeof payload === 'object'
            ? (payload as { error?: { requestId?: unknown } }).error?.requestId
            : undefined
        const rid = typeof requestId === 'string' ? requestId : null

        if (isHouseCloserOverride && response.status === 500) {
          const suffix = rid ? ` (requestId: ${rid})` : ''
          setCheckoutError(`${errorMessage}${suffix}`)
          return
        }

        setCheckoutError(showActionable ? errorMessage : 'Checkout is currently unavailable. Please try again later.')
        return
      }

      // Success response - extract URL and redirect
      const data = payload as { ok?: boolean; data?: { url?: string }; url?: string } | null
      
      // Handle standardized response: { ok: true, data: { url } }
      const checkoutUrl = data?.data?.url || data?.url
      
      if (checkoutUrl && typeof checkoutUrl === 'string') {
        window.location.href = checkoutUrl
      } else {
        console.error('[Pricing] No checkout URL in response:', data)
        setCheckoutError('Checkout is currently unavailable. Please try again later.')
      }
    } catch (error: unknown) {
      // Network error or other exception
      console.error('[Pricing] Checkout exception:', error)
      setCheckoutError(formatErrorMessage(error))
    } finally {
      setIsCheckoutLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid py-20">
      <AuthedSettingsStamp payload={{ pricing_viewed_at: pricingViewedAt }} sessionKey="pricing_viewed" />
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bloomberg-font neon-cyan mb-4">{COPY.pricing.hero.headline}</h1>
          <p className="text-muted-foreground text-lg">{COPY.pricing.hero.subhead}</p>
          <div className="mt-6 max-w-3xl mx-auto">
            <ul className="text-sm text-muted-foreground space-y-1">
              {COPY.pricing.hero.bullets.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
            <div className="mt-4 text-xs text-muted-foreground">{COPY.pricing.hero.trustStrip(SUPPORT_EMAIL)}</div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="neon-border hover:glow-effect">
                <a href="/signup?redirect=/onboarding">{COPY.pricing.hero.primaryCta}</a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#plan-closer">{COPY.pricing.hero.secondaryCta}</a>
              </Button>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-card/40 p-1 text-xs">
              <button
                type="button"
                className={
                  billingCycle === 'monthly'
                    ? 'rounded-full px-3 py-1 text-cyan-200 bg-cyan-500/10 border border-cyan-500/20'
                    : 'rounded-full px-3 py-1 text-muted-foreground hover:text-cyan-200'
                }
                onClick={() => setBillingCycle('monthly')}
                aria-label="Select monthly billing"
              >
                Monthly
              </button>
              <button
                type="button"
                className={
                  billingCycle === 'annual'
                    ? 'rounded-full px-3 py-1 text-cyan-200 bg-cyan-500/10 border border-cyan-500/20'
                    : 'rounded-full px-3 py-1 text-muted-foreground hover:text-cyan-200'
                }
                onClick={() => setBillingCycle('annual')}
                aria-label="Select annual billing"
              >
                Annual (save 2 months)
              </button>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {billingCycle === 'annual' ? 'Billed annually.' : 'Switch to annual to save 2 months.'}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mb-8">
          <OutcomePricingIntro />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <div id="plan-starter">
          <Card className="border-cyan-500/10 bg-card/50">
            <CardHeader>
              <CardTitle className="text-2xl bloomberg-font">Starter</CardTitle>
              <div className="mt-1 text-xs font-semibold text-muted-foreground">Validate the workflow</div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-5xl font-bold neon-cyan">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription>{COPY.pricing.plans.starterDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Validate the workflow with a sample digest
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Free plan: 3 preview generations total
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Generate up to 3 pitch/report previews on Free
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Browse the templates library
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Full premium content stays locked until you upgrade
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Usage is shared across pitches and reports
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Upgrade anytime
                </li>
              </ul>
              <Button asChild variant="outline" className="w-full h-11">
                <a href="/signup?redirect=/onboarding">{COPY.pricing.hero.primaryCta}</a>
              </Button>
            </CardContent>
          </Card>
          </div>

          <div id="plan-closer">
          <Card className="border-cyan-500/30 bg-card/80 glow-effect relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-cyan-500/20 to-transparent w-32 h-32 blur-3xl" />
            <div className="absolute bottom-0 left-0 bg-gradient-to-r from-blue-500/20 to-transparent w-32 h-32 blur-3xl" />

            <CardHeader className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-2xl bloomberg-font">Closer</CardTitle>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Most Popular</Badge>
              </div>
              <div className="text-xs font-semibold text-muted-foreground">Daily prioritization and faster execution</div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-5xl font-bold neon-cyan">{formatCurrency(closerPrice)}</span>
                <span className="text-muted-foreground">{cadenceLabel}</span>
              </div>
              {billingCycle === 'annual' && (
                <div className="mt-2 text-xs text-muted-foreground">Equivalent to {formatCurrency(PRICING.closerMonthly)}/mo.</div>
              )}
              <CardDescription>
                {COPY.pricing.plans.closerDescription}
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-10 space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Daily shortlist for your watchlist</p>
                    <p className="text-sm text-muted-foreground">A ranked list of accounts to action today</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Lead scoring (0–100) with reasons</p>
                    <p className="text-sm text-muted-foreground">Deterministic ranking — no guesswork</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Send-ready drafts (email, DM, call opener)</p>
                    <p className="text-sm text-muted-foreground">Generate first touches without a blank page</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Unlimited competitive reports</p>
                    <p className="text-sm text-muted-foreground">Save and reuse sourced reports in one hub</p>
                  </div>
                </li>
              </ul>

              {checkoutError && (
                <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <p className="font-medium text-sm">{checkoutError}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button 
                onClick={() => void handleCheckout('pro')}
                disabled={isCheckoutLoading}
                className="w-full h-12 text-lg font-bold neon-border hover:glow-effect bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
                size="lg"
              >
                {isCheckoutLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Upgrade to Closer
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Cancel anytime. No hidden fees.
              </p>
            </CardContent>
          </Card>
          </div>

          <div id="plan-closer-plus">
            <Card className="border-purple-500/30 bg-card/70 glow-effect relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-500/20 to-transparent w-32 h-32 blur-3xl" />
              <CardHeader className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-2xl bloomberg-font">Closer+</CardTitle>
                  <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/25">Power user</Badge>
                </div>
                <div className="text-xs font-semibold text-muted-foreground">Deeper context for operators</div>
                <div className="flex items-baseline gap-2 mt-4">
                  <span className="text-5xl font-bold text-purple-200">{formatCurrency(closerPlusPrice)}</span>
                  <span className="text-muted-foreground">{cadenceLabel}</span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Equivalent to {formatCurrency(PRICING.closerPlusMonthly)}/mo.
                  </div>
                )}
                <CardDescription>
                  Deeper source-backed context and premium report workflow for operators.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 space-y-6">
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Everything in Closer</p>
                      <p className="text-sm text-muted-foreground">Plus deeper competitive report workflow</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Sources &amp; freshness visibility</p>
                      <p className="text-sm text-muted-foreground">See what was fetched and when, with citations</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Refresh sources + regenerate</p>
                      <p className="text-sm text-muted-foreground">Pull current citations and rebuild the report</p>
                    </div>
                  </li>
                </ul>
                <Button
                  onClick={() => void handleCheckout('closer_plus')}
                  disabled={isCheckoutLoading}
                  className="w-full h-12 text-lg font-bold neon-border hover:glow-effect bg-purple-500/10 hover:bg-purple-500/20 text-purple-200"
                  size="lg"
                >
                  {isCheckoutLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Upgrade to Closer+
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">Cancel anytime. No hidden fees.</p>
              </CardContent>
            </Card>
          </div>

          <div id="plan-team">
            <Card className="border-slate-500/20 bg-card/50 relative overflow-hidden">
              <div className="absolute top-0 left-0 bg-gradient-to-r from-slate-500/10 to-transparent w-32 h-32 blur-3xl" />
              <CardHeader className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-2xl bloomberg-font">Team</CardTitle>
                  <Badge className="bg-slate-500/10 text-slate-200 border-slate-500/20">Seats</Badge>
                </div>
                <div className="text-xs font-semibold text-muted-foreground">Governance and rollout</div>
                <div className="mt-4 flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-slate-100">{formatCurrency(teamBasePrice)}</span>
                    <span className="text-muted-foreground">{cadenceLabel}</span>
                  </div>
                  <div className="text-sm text-muted-foreground leading-tight">
                    + {formatCurrency(teamSeatPrice)}/seat{billingCycle === 'annual' ? '/year' : '/month'}
                  </div>
                </div>
                {billingCycle === 'annual' && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Equivalent to {formatCurrency(PRICING.teamBaseMonthly)} base + {formatCurrency(PRICING.teamSeatMonthly)}/seat per month.
                  </div>
                )}
                <CardDescription>
                  For teams that need shared reporting, consistent messaging, and rollout across reps.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Seats</div>
                    <div className="text-xs text-muted-foreground">{teamSeats}</div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={teamSeats}
                    onChange={(e) => setTeamSeats(Number(e.target.value))}
                    className="w-full"
                    aria-label="Team seat count"
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Checkout uses seat quantity. If you configure base + seat prices, we’ll include both line items.
                  </div>
                </div>

                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Standardized team workflow</p>
                      <p className="text-sm text-muted-foreground">Governance and rollout across reps</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Shared templates with approvals</p>
                      <p className="text-sm text-muted-foreground">Draft → approve → reuse across reps</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Audit logs</p>
                      <p className="text-sm text-muted-foreground">Admin visibility on member and template actions</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Webhooks + exports</p>
                      <p className="text-sm text-muted-foreground">Handoff packages + workspace queue + delivery history (via webhook/export workflows)</p>
                    </div>
                  </li>
                </ul>

                <Button
                  onClick={() => void handleCheckout('team')}
                  disabled={isCheckoutLoading}
                  className="w-full h-12 text-lg font-bold neon-border hover:glow-effect bg-slate-500/10 hover:bg-slate-500/20 text-slate-100"
                  size="lg"
                >
                  {isCheckoutLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5 mr-2" />
                      Start Team
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">Cancel anytime. Seat changes happen in Stripe.</p>
              </CardContent>
            </Card>
          </div>

        </div>

        <div ref={upgradeRef} className="mt-12 max-w-6xl mx-auto">
          <Card className="border-cyan-500/10 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Why teams upgrade</CardTitle>
              <CardDescription>Outcome differences that change rep execution speed and team operations.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-3">Reason</th>
                    <th className="text-left py-2 pr-3">What changes</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['More tracked accounts', 'Move from a sample workflow to daily execution across your watchlist.'],
                    ['Full pitch/report access', 'Unlock full content and reuse outputs without locked sections.'],
                    ['Saved workflow outputs', 'Keep briefs, reports, and drafts available for reopening and iteration.'],
                    ['Team standardization', 'Shared templates and approvals keep messaging consistent across reps.'],
                    ['Webhook/export operations', 'Handoff packages, workspace queue, and delivery history to fit your operating system.'],
                    ['Audit visibility', 'Admin visibility for governance and rollout workflows.'],
                  ].map(([reason, detail]) => (
                    <tr key={reason} className="border-b border-cyan-500/10">
                      <td className="py-2 pr-3 font-medium text-foreground">{reason}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 max-w-4xl mx-auto">
          <Card className="border-cyan-500/10 bg-card/50">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold">The ROI is speed-to-action.</h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>• Spend less time deciding who to contact today.</p>
                <p>• Move from “signal” to “send-ready” without blank-page writing.</p>
                <p>• Keep the daily loop consistent: shortlist → explain → draft → action.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 max-w-6xl mx-auto">
          <Card className="border-cyan-500/10 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">FAQ</CardTitle>
              <CardDescription>Clear answers to the questions buyers ask before approving spend.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
              <div>
                <div className="font-medium text-foreground">What does “Annual (save 2 months)” mean?</div>
                <div className="mt-1">
                  Annual billing is priced at <span className="font-medium text-foreground">10× the monthly rate</span>. You
                  get the same plan, paid once per year.
                </div>
              </div>
              <div>
                <div className="font-medium text-foreground">Can I cancel anytime?</div>
                <div className="mt-1">
                  Yes. Use <span className="font-medium text-foreground">Manage billing</span> in the dashboard to open Stripe
                  and cancel or adjust your subscription.
                </div>
              </div>
              <div>
                <div className="font-medium text-foreground">How do Team seats work?</div>
                <div className="mt-1">
                  Team includes a base subscription plus a per-seat price. Set the seat count at checkout and change it later
                  in Stripe.
                </div>
              </div>
              <div>
                <div className="font-medium text-foreground">Is my data safe?</div>
                <div className="mt-1">
                  Billing runs on Stripe. Authentication runs on Supabase. We avoid exposing secrets to the client and enforce
                  structured API responses across the app.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 max-w-6xl mx-auto">
          <Card className="border-cyan-500/10 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Buyer checklist</CardTitle>
              <CardDescription>What procurement and security reviewers usually ask for.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
              <div className="space-y-2">
                <div className="font-medium text-foreground">Trust docs</div>
                <div className="flex flex-wrap gap-3">
                  <a
                    className="text-cyan-400 hover:underline"
                    href="/trust"
                    onClick={() => track('pricing_trust_link_clicked', { href: '/trust' })}
                  >
                    Trust Center
                  </a>
                  <a
                    className="text-cyan-400 hover:underline"
                    href="/trust/buyer-readiness"
                    onClick={() => track('pricing_trust_link_clicked', { href: '/trust/buyer-readiness' })}
                  >
                    Buyer readiness
                  </a>
                  <a
                    className="text-cyan-400 hover:underline"
                    href="/privacy"
                    onClick={() => track('pricing_trust_link_clicked', { href: '/privacy' })}
                  >
                    Privacy
                  </a>
                  <a
                    className="text-cyan-400 hover:underline"
                    href="/terms"
                    onClick={() => track('pricing_trust_link_clicked', { href: '/terms' })}
                  >
                    Terms
                  </a>
                  <a
                    className="text-cyan-400 hover:underline"
                    href="/subprocessors"
                    onClick={() => track('pricing_trust_link_clicked', { href: '/subprocessors' })}
                  >
                    Subprocessors
                  </a>
                  <a
                    className="text-cyan-400 hover:underline"
                    href="/dpa"
                    onClick={() => track('pricing_trust_link_clicked', { href: '/dpa' })}
                  >
                    DPA
                  </a>
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-medium text-foreground">Operations</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Cancel and change seats via Stripe customer portal (in-app “Manage billing”).</li>
                  <li>
                    Data deletion requests: email <span className="font-medium text-foreground">{SUPPORT_EMAIL}</span>.
                  </li>
                  <li>
                    Service status and deploy info: <a className="text-cyan-400 hover:underline" href="/status">/status</a> and{' '}
                    <a className="text-cyan-400 hover:underline" href="/version">/version</a>.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 max-w-6xl mx-auto">
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Need deeper controls or rollout support?</CardTitle>
              <CardDescription>
                LeadIntel already supports serious team workflows. For buyers evaluating larger deployments, contact us about roadmap alignment, workflow
                design, and operational requirements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li>Higher-volume workflow needs</li>
                <li>Custom rollout guidance</li>
                <li>Deeper audit expectations</li>
                <li>Future enterprise controls</li>
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="neon-border hover:glow-effect">
                  <a href="/support">Contact support</a>
                </Button>
                <Button asChild variant="outline">
                  <a href={`mailto:${SUPPORT_EMAIL}`}>Email {SUPPORT_EMAIL}</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="border-cyan-500/10 bg-card/50 text-center">
            <CardContent className="pt-6">
              <Shield className="h-8 w-8 mx-auto mb-3 text-cyan-400" />
              <h3 className="font-bold mb-2">Secure Payment</h3>
              <p className="text-sm text-muted-foreground">
                Powered by Stripe. Payment details stay in Stripe.
              </p>
            </CardContent>
          </Card>
          <Card className="border-cyan-500/10 bg-card/50 text-center">
            <CardContent className="pt-6">
              <TrendingUp className="h-8 w-8 mx-auto mb-3 text-green-400" />
              <h3 className="font-bold mb-2">Built for daily execution</h3>
              <p className="text-sm text-muted-foreground">
                {COPY.pricing.plans.replacementClaim}
              </p>
            </CardContent>
          </Card>
          <Card className="border-cyan-500/10 bg-card/50 text-center">
            <CardContent className="pt-6">
              <Zap className="h-8 w-8 mx-auto mb-3 text-purple-400" />
              <h3 className="font-bold mb-2">Instant Access</h3>
              <p className="text-sm text-muted-foreground">
                Get started immediately after subscription.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
