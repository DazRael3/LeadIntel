'use client'

import { useState, useEffect } from 'react'
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
         lowerMessage.includes('stripe configuration')
}

export function Pricing() {
  const router = useRouter()
  const [target, setTarget] = useState<string | null>(null) // optional: closer
  const supabase = createClient()
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const { isPro } = usePlan()
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [teamSeats, setTeamSeats] = useState<number>(5)

  const closerPrice = billingCycle === 'annual' ? annualFromMonthly(PRICING.closerMonthly) : PRICING.closerMonthly
  const closerPlusPrice =
    billingCycle === 'annual' ? annualFromMonthly(PRICING.closerPlusMonthly) : PRICING.closerPlusMonthly
  const teamBasePrice = billingCycle === 'annual' ? annualFromMonthly(PRICING.teamBaseMonthly) : PRICING.teamBaseMonthly
  const teamSeatPrice = billingCycle === 'annual' ? annualFromMonthly(PRICING.teamSeatMonthly) : PRICING.teamSeatMonthly
  const cadenceLabel = billingCycle === 'annual' ? '/year' : '/month'

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

  const handleCheckout = async (planId: PaidPlanId) => {
    setIsCheckoutLoading(true)
    setCheckoutError(null)
    
    try {
      track('pricing_cta_clicked', { source: 'pricing', planId })
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
        // User-friendly message (do not leak internals). Keep details in console logs.
        setCheckoutError('Checkout is currently unavailable. Please try again later.')
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
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bloomberg-font neon-cyan mb-4">Pricing</h1>
          <p className="text-muted-foreground text-lg">
            Premium, ROI-focused outbound engine — built to create pipeline, not dashboards.
          </p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <div id="plan-starter">
          <Card className="border-cyan-500/10 bg-card/50">
            <CardHeader>
              <CardTitle className="text-2xl bloomberg-font">Starter</CardTitle>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-5xl font-bold neon-cyan">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription>Free (limited) — kick the tires with limited scoring and basic pitches.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Basic pitch generation
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Limited scoring and signals
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 mt-0.5" />
                  Upgrade anytime
                </li>
              </ul>
              <Button asChild variant="outline" className="w-full h-11">
                <a href="/signup?redirect=/dashboard">Start free</a>
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
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-5xl font-bold neon-cyan">{formatCurrency(closerPrice)}</span>
                <span className="text-muted-foreground">{cadenceLabel}</span>
              </div>
              {billingCycle === 'annual' && (
                <div className="mt-2 text-xs text-muted-foreground">Equivalent to {formatCurrency(PRICING.closerMonthly)}/mo.</div>
              )}
              <CardDescription>
                For solo reps who want a daily deal shortlist and conversion-ready templates.
              </CardDescription>
            </CardHeader>

            <CardContent className="relative z-10 space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Daily Deal Digest email with ranked accounts</p>
                    <p className="text-sm text-muted-foreground">Wake up to the shortlist you can act on</p>
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
                    <p className="font-medium">AI pitch templates (email, call opener, LinkedIn DM)</p>
                    <p className="text-sm text-muted-foreground">Pick a format and send faster</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">More accounts and trigger events</p>
                    <p className="text-sm text-muted-foreground">Higher limits and priority processing</p>
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
                  For operators who want deeper competitive coverage, automation, and higher throughput.
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
                      <p className="text-sm text-muted-foreground">Plus expanded competitive analysis</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">More signals + deeper sources</p>
                      <p className="text-sm text-muted-foreground">Better trigger coverage and history</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Priority processing</p>
                      <p className="text-sm text-muted-foreground">Faster report generation</p>
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
                      <p className="font-medium">Everything in Closer+</p>
                      <p className="text-sm text-muted-foreground">Plus shared workflows</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Team-wide standards</p>
                      <p className="text-sm text-muted-foreground">Templates and reports are consistent</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Admin visibility</p>
                      <p className="text-sm text-muted-foreground">Better oversight across reps</p>
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

        <div className="mt-12 max-w-4xl mx-auto">
          <Card className="border-cyan-500/10 bg-card/50">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold">One meeting pays for the month.</h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>• Stop spraying sequences at cold lists — focus on accounts with real buying signals.</p>
                <p>• Spend mornings in your inbox and on calls, not bouncing between tabs.</p>
                <p>• Standardize winning messaging across your org with templates that convert.</p>
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

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="border-cyan-500/10 bg-card/50 text-center">
            <CardContent className="pt-6">
              <Shield className="h-8 w-8 mx-auto mb-3 text-cyan-400" />
              <h3 className="font-bold mb-2">Secure Payment</h3>
              <p className="text-sm text-muted-foreground">
                Powered by Stripe. Your data is encrypted and secure.
              </p>
            </CardContent>
          </Card>
          <Card className="border-cyan-500/10 bg-card/50 text-center">
            <CardContent className="pt-6">
              <TrendingUp className="h-8 w-8 mx-auto mb-3 text-green-400" />
              <h3 className="font-bold mb-2">Proven Results</h3>
              <p className="text-sm text-muted-foreground">
                Join hundreds of sales orgs closing more deals.
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
