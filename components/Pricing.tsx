'use client'

import { useState, useEffect, useRef } from 'react'
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
import { usePublicAbVariant } from '@/lib/experiments/usePublicAbVariant'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { OutcomePricingIntro } from '@/components/marketing/OutcomePricingIntro'
import { LeadCaptureCard } from '@/components/marketing/LeadCaptureCard'
import { useStripePortal } from '@/app/dashboard/hooks/useStripePortal'

type UpgradeBlockerReason =
  | 'too_expensive'
  | 'unclear_value'
  | 'missing_feature'
  | 'timing'
  | 'just_exploring'
  | 'other'

type PaidPlanId = 'pro' | 'closer_plus' | 'team'
type BillingCycle = 'monthly' | 'annual'
type CheckoutErrorCode =
  | 'CHECKOUT_CONFIG_MISSING'
  | 'AUTH_REQUIRED'
  | 'INVALID_CHECKOUT_PAYLOAD'
  | 'UNSUPPORTED_PLAN'
  | 'STRIPE_CUSTOMER_INVALID'
  | 'CHECKOUT_SESSION_CREATE_FAILED'
  | 'INTERNAL_CHECKOUT_ERROR'

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

    // Check for direct message property
    if (typeof obj.message === 'string') {
      return obj.message
    }
    
    // Fallback to formatErrorMessage for other object shapes
    return formatErrorMessage(payload)
  }
  
  return 'An unexpected error occurred'
}

function extractCheckoutErrorCode(payload: unknown): CheckoutErrorCode | null {
  if (!payload || typeof payload !== 'object') return null
  const maybeCode = (payload as { error?: { code?: unknown } }).error?.code
  if (typeof maybeCode !== 'string') return null
  const codes: CheckoutErrorCode[] = [
    'CHECKOUT_CONFIG_MISSING',
    'AUTH_REQUIRED',
    'INVALID_CHECKOUT_PAYLOAD',
    'UNSUPPORTED_PLAN',
    'STRIPE_CUSTOMER_INVALID',
    'CHECKOUT_SESSION_CREATE_FAILED',
    'INTERNAL_CHECKOUT_ERROR',
  ]
  return codes.includes(maybeCode as CheckoutErrorCode) ? (maybeCode as CheckoutErrorCode) : null
}

function checkoutMessageForCode(code: CheckoutErrorCode | null): string | null {
  if (code === 'CHECKOUT_CONFIG_MISSING') return 'Checkout is not configured yet.'
  if (code === 'AUTH_REQUIRED') return 'Please sign in to upgrade.'
  if (code === 'UNSUPPORTED_PLAN') return 'Selected plan is unavailable.'
  if (code === 'INVALID_CHECKOUT_PAYLOAD') return 'Checkout request was invalid. Please refresh and try again.'
  if (code === 'STRIPE_CUSTOMER_INVALID') return 'Checkout is temporarily unavailable. Please try again shortly.'
  if (code === 'CHECKOUT_SESSION_CREATE_FAILED') return 'Checkout is temporarily unavailable. Please try again shortly.'
  if (code === 'INTERNAL_CHECKOUT_ERROR') return 'Checkout is currently unavailable. Please try again later.'
  return null
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
  const { tier, isPro, isHouseCloserOverride } = usePlan()
  const { openPortal } = useStripePortal()
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [teamSeats, setTeamSeats] = useState<number>(5)
  const [addOnLeadPacks, setAddOnLeadPacks] = useState<number>(0)
  const [upgradeBlockerReason, setUpgradeBlockerReason] = useState<UpgradeBlockerReason>('too_expensive')
  const [upgradeBlockerDetail, setUpgradeBlockerDetail] = useState('')
  const [isSubmittingUpgradeFeedback, setIsSubmittingUpgradeFeedback] = useState(false)
  const [upgradeFeedbackSubmitted, setUpgradeFeedbackSubmitted] = useState(false)
  const [upgradeFeedbackError, setUpgradeFeedbackError] = useState<string | null>(null)
  const upgradeRef = useRef<HTMLDivElement | null>(null)
  const pricingAb = usePublicAbVariant({
    key: 'pricing_copy_test_v1',
    variants: ['control', 'value_focused'],
    fallback: 'control',
  })

  const closerPrice = billingCycle === 'annual' ? annualFromMonthly(PRICING.closerMonthly) : PRICING.closerMonthly
  const closerPlusPrice =
    billingCycle === 'annual' ? annualFromMonthly(PRICING.closerPlusMonthly) : PRICING.closerPlusMonthly
  const teamBasePrice = billingCycle === 'annual' ? annualFromMonthly(PRICING.teamBaseMonthly) : PRICING.teamBaseMonthly
  const teamSeatPrice = billingCycle === 'annual' ? annualFromMonthly(PRICING.teamSeatMonthly) : PRICING.teamSeatMonthly
  const cadenceLabel = billingCycle === 'annual' ? '/year' : '/month'
  const leadPackUnitPrice = billingCycle === 'annual' ? annualFromMonthly(29) : 29

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

  const currentPlanLabel =
    tier === 'team' ? 'Team' : tier === 'closer_plus' ? 'Pro+' : tier === 'closer' ? 'Pro' : 'Free'

  const recommendedTarget: PaidPlanId | null =
    tier === 'starter' ? 'pro' : tier === 'closer' ? 'closer_plus' : tier === 'closer_plus' ? 'team' : null

  const recommendedLabel =
    recommendedTarget === 'pro'
      ? 'Upgrade to Pro'
      : recommendedTarget === 'closer_plus'
        ? 'Upgrade to Pro+'
        : recommendedTarget === 'team'
          ? 'Upgrade to Team'
          : null

  const recommendedAnchor =
    recommendedTarget === 'pro'
      ? '#plan-closer'
      : recommendedTarget === 'closer_plus'
        ? '#plan-closer-plus'
        : recommendedTarget === 'team'
          ? '#plan-team'
          : null

  // Note: We intentionally do NOT redirect paid users away from /pricing.
  // Buyers often compare plans while signed in (and audits rely on /pricing rendering as-is).

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
      track('checkout_started', {
        source: 'pricing',
        planId,
        billingCycle,
        seats: planId === 'team' ? teamSeats : undefined,
      })
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
        const code = extractCheckoutErrorCode(payload)
        const mappedMessage = checkoutMessageForCode(code)
        // Owner debugging: if you're using the House Closer override, show safe error details
        // (Stripe code/type/request id) so you can fix config quickly.
        const requestId =
          payload && typeof payload === 'object'
            ? (payload as { error?: { requestId?: unknown } }).error?.requestId
            : undefined
        const rid = typeof requestId === 'string' ? requestId : null

        if (isHouseCloserOverride && response.status === 500) {
          const suffix = rid ? ` (requestId: ${rid})` : ''
          setCheckoutError(`${mappedMessage ?? errorMessage}${suffix}`)
          return
        }

        if (mappedMessage) {
          setCheckoutError(mappedMessage)
          return
        }

        const showActionable =
          response.status === 500 &&
          (errorMessage.toLowerCase().includes('checkout is not configured') || isStripeConfigError(errorMessage))
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

  const submitUpgradeBlockerFeedback = async () => {
    if (isSubmittingUpgradeFeedback || upgradeFeedbackSubmitted) return
    setUpgradeFeedbackError(null)
    setIsSubmittingUpgradeFeedback(true)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: '/pricing',
          surface: 'pricing_upgrade_blocker_prompt',
          sentiment: 'note',
          message: `What stopped you from upgrading? reason=${upgradeBlockerReason}; detail=${upgradeBlockerDetail.trim() || 'n/a'}`,
          deviceClass: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
          viewport:
            typeof window !== 'undefined'
              ? { w: Math.floor(window.innerWidth), h: Math.floor(window.innerHeight) }
              : undefined,
        }),
      })
      if (!response.ok) {
        setUpgradeFeedbackError('Could not send feedback. Please try again.')
        return
      }
      track('upgrade_feedback_submitted', {
        source: 'pricing',
        reason: upgradeBlockerReason,
      })
      setUpgradeFeedbackSubmitted(true)
      setUpgradeBlockerDetail('')
    } catch {
      setUpgradeFeedbackError('Could not send feedback. Please try again.')
    } finally {
      setIsSubmittingUpgradeFeedback(false)
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid py-20">
      <div className="container mx-auto px-6">
        {/* Signed-in conversion helper: show current plan + clear next action (mobile-friendly) */}
        <div className="mx-auto mb-6 max-w-6xl">
          <div className="rounded-lg border border-cyan-500/10 bg-card/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Your plan</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                    {currentPlanLabel}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {tier === 'starter'
                      ? 'Preview mode — upgrade to unlock full saved outputs and reusable workflow.'
                      : 'You can compare plans here anytime.'}
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {tier !== 'starter' ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10"
                    onClick={() => {
                      track('billing_portal_clicked', { surface: 'pricing_banner', tier })
                      void openPortal()
                    }}
                  >
                    Manage billing
                  </Button>
                ) : null}
                {recommendedTarget && recommendedLabel && recommendedAnchor ? (
                  <Button
                    type="button"
                    className="min-h-10 neon-border hover:glow-effect"
                    onClick={() => {
                      track('pricing_recommended_cta_clicked', { tier, target: recommendedTarget })
                      try {
                        const el = document.querySelector(recommendedAnchor)
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        else window.location.hash = recommendedAnchor
                      } catch {
                        window.location.hash = recommendedAnchor
                      }
                    }}
                  >
                    {recommendedLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bloomberg-font neon-cyan mb-4">
            {pricingAb.variant === 'value_focused'
              ? 'Turn lead signals into repeatable outbound execution'
              : COPY.pricing.hero.headline}
          </h1>
          <p className="text-muted-foreground text-lg">
            {pricingAb.variant === 'value_focused'
              ? 'Choose a plan built to help teams move from signal monitoring to consistent daily outreach.'
              : COPY.pricing.hero.subhead}
          </p>
          <div className="mt-6 max-w-3xl mx-auto">
            <ul className="text-sm text-muted-foreground space-y-1">
              {COPY.pricing.hero.bullets.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
            <div className="mt-4 text-xs text-muted-foreground">{COPY.pricing.hero.trustStrip(SUPPORT_EMAIL)}</div>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" className="neon-border hover:glow-effect">
                  <a href="/signup?redirect=/onboarding">
                    {pricingAb.variant === 'value_focused' ? 'Start converting leads' : COPY.pricing.hero.primaryCta}
                  </a>
                </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#plan-pro">{pricingAb.variant === 'value_focused' ? 'Compare conversion plans' : COPY.pricing.hero.secondaryCta}</a>
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
          <div className="mt-4 rounded border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Optimize your path</div>
            <p className="mt-1">
              {pricingAb.variant === 'value_focused'
                ? 'For many teams, one win can outweigh annual software cost (depends on ACV and execution).'
                : 'Start with a daily workflow and scale into predictable outbound execution.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <div id="plan-starter">
          <Card className="border-cyan-500/10 bg-card/50">
            <CardHeader>
              <CardTitle className="text-2xl bloomberg-font">Free</CardTitle>
              <div className="mt-1 text-xs font-semibold text-muted-foreground">Test the system</div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-5xl font-bold neon-cyan">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription>Preview the system before upgrading</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Preview real leads before committing
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Unlock up to 3 preview leads
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Limited preview outreach drafts
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Best for trying the system
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Limited preview
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  No credit card for demo
                </li>
              </ul>
              <Button asChild variant="outline" className="w-full h-11">
                <a href="/signup?redirect=/onboarding">Start free</a>
              </Button>
            </CardContent>
          </Card>
          </div>

          <div id="plan-pro">
          <Card className="border-cyan-400/70 bg-card/90 glow-effect relative overflow-hidden ring-2 ring-cyan-400/40 scale-[1.01]">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-cyan-500/20 to-transparent w-32 h-32 blur-3xl" />
            <div className="absolute bottom-0 left-0 bg-gradient-to-r from-blue-500/20 to-transparent w-32 h-32 blur-3xl" />

            <CardHeader className="relative z-10">
              <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl bloomberg-font">Pro</CardTitle>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Default choice</Badge>
              </div>
                <div className="text-xs font-semibold text-muted-foreground">Best for individuals closing deals</div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-5xl font-bold neon-cyan">{formatCurrency(closerPrice)}</span>
                <span className="text-muted-foreground">{cadenceLabel}</span>
              </div>
              {billingCycle === 'annual' && (
                <div className="mt-2 text-xs text-muted-foreground">Equivalent to {formatCurrency(PRICING.closerMonthly)}/mo.</div>
              )}
              <CardDescription>Individual daily pipeline execution</CardDescription>
            </CardHeader>

            <CardContent className="relative z-10 space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Daily high-intent leads</p>
                    <p className="text-sm text-muted-foreground">Find qualified accounts without manual research loops</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">AI-assisted outreach drafts you can adapt</p>
                    <p className="text-sm text-muted-foreground">Send usable messages faster with less rewrite effort</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Consistent pipeline without manual research</p>
                    <p className="text-sm text-muted-foreground">Run the same high-signal workflow every day</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">50+ leads and reusable playbooks</p>
                    <p className="text-sm text-muted-foreground">Expand output while keeping your workflow repeatable</p>
                  </div>
                </li>
              </ul>
              <div className="rounded border border-cyan-500/20 bg-background/40 p-3 text-xs text-muted-foreground">
                <div>Illustrative economics: one win can outweigh annual software cost.</div>
                <div>Compare against your current lead sourcing and research costs.</div>
                <div>Leads refresh daily.</div>
              </div>

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
                    Upgrade to Pro
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
                  <CardTitle className="text-2xl bloomberg-font">Pro+</CardTitle>
                  <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/25">Power user</Badge>
                </div>
                <div className="text-xs font-semibold text-muted-foreground">Best for advanced solo operators</div>
                <div className="flex items-baseline gap-2 mt-4">
                  <span className="text-5xl font-bold text-purple-200">{formatCurrency(closerPlusPrice)}</span>
                  <span className="text-muted-foreground">{cadenceLabel}</span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Equivalent to {formatCurrency(PRICING.closerPlusMonthly)}/mo.
                  </div>
                )}
                <CardDescription>Power user / advanced execution</CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 space-y-6">
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Everything in Pro</p>
                      <p className="text-sm text-muted-foreground">Keep your best workflow, then increase daily output.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">More leads with richer context</p>
                      <p className="text-sm text-muted-foreground">Prioritize timing with deeper signal and freshness detail.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Refresh and iterate faster</p>
                      <p className="text-sm text-muted-foreground">Regenerate outreach and stay aligned as accounts change.</p>
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
                      Upgrade to Pro+
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
                <div className="text-xs font-semibold text-muted-foreground">Best for teams scaling pipeline</div>
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
                <CardDescription>Shared outbound workflow</CardDescription>
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Add-on lead packs (prep)</div>
                    <div className="text-xs text-muted-foreground">{addOnLeadPacks}</div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={addOnLeadPacks}
                    onChange={(e) => setAddOnLeadPacks(Number(e.target.value))}
                    className="w-full"
                    aria-label="Add-on lead packs preview"
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Optional add-on packs: {formatCurrency(leadPackUnitPrice)} each{billingCycle === 'annual' ? '/year' : '/month'} (preview only).
                  </div>
                </div>

                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Shared pipeline + team workflows</p>
                      <p className="text-sm text-muted-foreground">Coordinate execution across reps in one workflow</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Scale outbound with visibility</p>
                      <p className="text-sm text-muted-foreground">Track activity and progress across campaigns</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Multi-user collaboration</p>
                      <p className="text-sm text-muted-foreground">Shared templates, approvals, and handoffs</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Webhooks + exports</p>
                      <p className="text-sm text-muted-foreground">Operational handoff for campaign delivery at scale</p>
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
                      Start Team Plan
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
              <h2 className="text-xl font-bold">ROI depends on execution quality and deal size.</h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>• Treat ROI examples as directional, not guarantees.</p>
                <p>• Compare plan cost to your current manual research and list-building spend.</p>
                <p>• Keep the daily loop consistent: find leads → send outreach → start conversations.</p>
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

        <div className="mt-12 max-w-6xl mx-auto">
          <LeadCaptureCard surface="pricing" />
        </div>

        <div className="mt-10 max-w-6xl mx-auto">
          <Card className="border-cyan-500/20 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">What stopped you from upgrading?</CardTitle>
              <CardDescription>Quick feedback helps us improve the upgrade experience.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <button
                  type="button"
                  className={`rounded border px-3 py-2 text-left ${
                    upgradeBlockerReason === 'too_expensive'
                      ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-cyan-500/10 bg-background/40'
                  }`}
                  onClick={() => setUpgradeBlockerReason('too_expensive')}
                >
                  Too expensive
                </button>
                <button
                  type="button"
                  className={`rounded border px-3 py-2 text-left ${
                    upgradeBlockerReason === 'unclear_value'
                      ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-cyan-500/10 bg-background/40'
                  }`}
                  onClick={() => setUpgradeBlockerReason('unclear_value')}
                >
                  Value not clear yet
                </button>
                <button
                  type="button"
                  className={`rounded border px-3 py-2 text-left ${
                    upgradeBlockerReason === 'missing_feature'
                      ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-cyan-500/10 bg-background/40'
                  }`}
                  onClick={() => setUpgradeBlockerReason('missing_feature')}
                >
                  Missing feature
                </button>
                <button
                  type="button"
                  className={`rounded border px-3 py-2 text-left ${
                    upgradeBlockerReason === 'timing'
                      ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-cyan-500/10 bg-background/40'
                  }`}
                  onClick={() => setUpgradeBlockerReason('timing')}
                >
                  Bad timing
                </button>
                <button
                  type="button"
                  className={`rounded border px-3 py-2 text-left ${
                    upgradeBlockerReason === 'just_exploring'
                      ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-cyan-500/10 bg-background/40'
                  }`}
                  onClick={() => setUpgradeBlockerReason('just_exploring')}
                >
                  Just exploring
                </button>
                <button
                  type="button"
                  className={`rounded border px-3 py-2 text-left ${
                    upgradeBlockerReason === 'other'
                      ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-cyan-500/10 bg-background/40'
                  }`}
                  onClick={() => setUpgradeBlockerReason('other')}
                >
                  Other
                </button>
              </div>
              <textarea
                className="w-full rounded border border-cyan-500/10 bg-background/40 px-3 py-2 text-sm text-foreground"
                rows={3}
                placeholder="Optional details"
                value={upgradeBlockerDetail}
                onChange={(event) => setUpgradeBlockerDetail(event.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void submitUpgradeBlockerFeedback()}
                  disabled={isSubmittingUpgradeFeedback || upgradeFeedbackSubmitted}
                >
                  {upgradeFeedbackSubmitted
                    ? 'Thanks for the feedback'
                    : isSubmittingUpgradeFeedback
                      ? 'Sending...'
                      : 'Send feedback'}
                </Button>
                {upgradeFeedbackError ? <span className="text-xs text-red-300">{upgradeFeedbackError}</span> : null}
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
              <h3 className="font-bold mb-2">Built for consistent execution</h3>
              <p className="text-sm text-muted-foreground">
                {COPY.pricing.plans.replacementClaim}
              </p>
            </CardContent>
          </Card>
          <Card className="border-cyan-500/10 bg-card/50 text-center">
            <CardContent className="pt-6">
              <Zap className="h-8 w-8 mx-auto mb-3 text-purple-400" />
              <h3 className="font-bold mb-2">No credit card for demo</h3>
              <p className="text-sm text-muted-foreground">
                Test the system before upgrading.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="mt-4 text-center text-xs text-muted-foreground">
          Questions? {SUPPORT_EMAIL}
        </div>
      </div>
    </div>
  )
}
