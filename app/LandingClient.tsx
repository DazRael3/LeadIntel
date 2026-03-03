'use client'

import { useEffect, useMemo, useState, useCallback } from "react"
import { PitchGenerator } from "@/components/PitchGenerator"
import { TriggerEventCard } from "@/components/TriggerEventCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { TriggerEvent } from "@/lib/supabaseClient"
import { TrendingUp, Zap, Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatErrorMessage } from "@/lib/utils/format-error"
import Link from "next/link"
import { BrandHero } from "@/components/BrandHero"
import { getUserSafe } from "@/lib/supabase/safe-auth"
import { OneMinuteDemo } from "@/components/landing/OneMinuteDemo"
import { TrySampleDigest } from "@/components/landing/TrySampleDigest"
import { track } from "@/lib/analytics"

type TriggerEventRow = {
  id: string
  company_name?: string | null
  company_domain?: string | null
  company_url?: string | null
  event_type?: string | null
  event_description?: string | null
  headline?: string | null
  source_url?: string | null
  detected_at?: string | null
  created_at?: string | null
}

const ALLOWED_EVENT_TYPES: TriggerEvent['event_type'][] = [
  'product_launch',
  'expansion',
  'funding',
  'new_hires',
  'partnership',
]

function normalizeEventType(value: string | null | undefined): TriggerEvent['event_type'] {
  if (!value) return 'expansion'
  const candidate = value as TriggerEvent['event_type']
  return ALLOWED_EVENT_TYPES.includes(candidate) ? candidate : 'expansion'
}

export default function LandingClient() {
  const [events, setEvents] = useState<TriggerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro'>('free')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [quickStats, setQuickStats] = useState<{ eventsToday: number; activeMonitors: number; pitchesGenerated: number } | null>(null)
  const router = useRouter()
  const { supabase } = useMemo(() => {
    try {
      return { supabase: createClient() as ReturnType<typeof createClient> }
    } catch {
      // If Supabase env vars are missing/malformed, render logged-out CTAs instead of crashing the whole page.
      return { supabase: null as ReturnType<typeof createClient> | null }
    }
  }, [])

  const loadEvents = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      setEvents([])
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('trigger_events')
        .select('id, user_id, company_name, company_domain, company_url, event_type, event_description, headline, source_url, detected_at, created_at')
        .order('detected_at', { ascending: false })
        .limit(20)

      if (error) {
        const errorMsg = formatErrorMessage(error)
        // Check if it's a schema mismatch - don't log as error, just warn
        if (errorMsg.includes('does not exist') || errorMsg.includes('column')) {
          console.warn('[Home] Schema mismatch on trigger_events, showing empty state')
        } else {
          console.error('[Home] Error loading events:', errorMsg)
        }
        setEvents([])
        return
      }
      
      // Normalize data with safe defaults
      const rows = (data ?? []) as TriggerEventRow[]
      const normalizedEvents: TriggerEvent[] = rows.map((row) => ({
        id: row.id,
        company_name: row.company_name || 'Unknown Company',
        event_type: normalizeEventType(row.event_type),
        event_description: row.event_description || '',
        source_url: row.source_url || '',
        detected_at: row.detected_at || row.created_at || new Date().toISOString(),
        company_url: row.company_url ?? undefined,
        company_domain: row.company_domain ?? undefined,
        headline: row.headline ?? undefined,
        created_at: row.created_at || new Date().toISOString(),
      }))
      
      setEvents(normalizedEvents)
    } catch (error) {
      console.error('[Home] Error loading events:', formatErrorMessage(error))
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const checkSubscription = useCallback(async () => {
    try {
      if (!supabase) return
      const user = await getUserSafe(supabase)
      if (!user) {
        return
      }
      
      const { data, error } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', user.id)
        .maybeSingle()
      
      if (error) {
        const errorMsg = formatErrorMessage(error)
        if (errorMsg.includes('does not exist') || errorMsg.includes('column')) {
          console.warn('[Home] Schema mismatch on users, defaulting to free tier')
        } else {
          console.error('[Home] Error checking subscription:', errorMsg)
        }
        return
      }
      
      if (data?.subscription_tier) {
        setSubscriptionTier(data.subscription_tier as 'free' | 'pro')
      }
    } catch (error) {
      console.error('[Home] Error checking subscription:', formatErrorMessage(error))
      // Keep default 'free' tier
    }
  }, [supabase])

  const loadQuickStats = useCallback(async () => {
    if (!supabase) {
      setQuickStats(null)
      return
    }
    const user = await getUserSafe(supabase)
    if (!user) {
      setQuickStats(null)
      return
    }

    // UTC "today"
    const now = new Date()
    const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
    const startIso = startUtc.toISOString()

    try {
      const [{ count: eventsToday }, { count: monitors }, { count: pitches }] = await Promise.all([
        supabase.from('trigger_events').select('id', { count: 'exact', head: true }).gte('detected_at', startIso),
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('pitches').select('id', { count: 'exact', head: true }),
      ])

      setQuickStats({
        eventsToday: typeof eventsToday === 'number' ? eventsToday : 0,
        activeMonitors: typeof monitors === 'number' ? monitors : 0,
        pitchesGenerated: typeof pitches === 'number' ? pitches : 0,
      })
    } catch {
      setQuickStats({ eventsToday: 0, activeMonitors: 0, pitchesGenerated: 0 })
    }
  }, [supabase])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      if (!supabase) {
        if (!cancelled) {
          setIsLoggedIn(false)
          setLoading(false)
          setEvents([])
        }
        return
      }

      try {
        const user = await getUserSafe(supabase)
        if (cancelled) return
        const loggedIn = !!user
        setIsLoggedIn(loggedIn)

        // Only load tenant-scoped data when authenticated.
        if (loggedIn) {
          loadEvents()
          checkSubscription()
          loadQuickStats()
        } else {
          setLoading(false)
          setEvents([])
          setSubscriptionTier('free')
          setQuickStats(null)
        }
      } catch {
        if (!cancelled) {
          setIsLoggedIn(false)
          setLoading(false)
          setEvents([])
          setQuickStats(null)
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [supabase, loadEvents, checkSubscription, loadQuickStats])

  useEffect(() => {
    if (!isLoggedIn) {
      track('landing_view', { path: '/' })
    }
  }, [isLoggedIn])

  const handleGeneratePitch = (companyUrl: string, companyName: string) => {
    router.push(`/pitch?url=${encodeURIComponent(companyUrl)}&name=${encodeURIComponent(companyName)}`)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">LeadIntel</h1>
              <p className="text-sm text-muted-foreground">B2B Lead Intelligence Portal</p>
            </div>
            <div className="flex items-center gap-4">
              {!isLoggedIn ? (
                <>
                  {/* Use real links so navigation works even if hydration is impaired. */}
                  <Button asChild variant="outline" size="sm">
                    <Link href="/login?mode=signin&redirect=/dashboard">Log in</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/signup?redirect=/dashboard">Sign up</Link>
                  </Button>
                </>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard">Command Center</Link>
                </Button>
              )}
              <Badge variant={subscriptionTier === 'pro' ? 'default' : 'outline'}>
                {subscriptionTier === 'pro' ? (
                  <>
                    <Shield className="h-3 w-3 mr-1" />
                    Pro
                  </>
                ) : (
                  'Free'
                )}
              </Badge>
              {isLoggedIn && subscriptionTier === 'free' && (
                <Button asChild size="sm">
                  <Link href="/pricing">Upgrade to Pro</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!isLoggedIn ? (
          <div className="space-y-16">
            {/* Hero */}
            <section className="pt-6">
              <div className="grid grid-cols-1 gap-8 items-start">
                <div className="max-w-4xl">
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                    Wake up to a daily shortlist of accounts ready to talk.
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    For B2B SDRs/AEs who need daily “why now” signals and ready-to-send outreach.
                  </p>
                  <p className="text-lg text-muted-foreground mt-4 max-w-3xl">
                    LeadIntel turns noisy markets into a <span className="font-semibold text-foreground">Daily Deal Digest</span>, scores your accounts
                    <span className="font-semibold text-foreground"> 0–100</span>, and generates <span className="font-semibold text-foreground">conversion-ready pitch templates</span> so you can
                    spend mornings booking meetings — not researching.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 mt-6">
                    <Button asChild size="lg" className="neon-border hover:glow-effect">
                      <Link href="#try-sample">Try a sample digest</Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link
                        href="/signup?redirect=/dashboard"
                        onClick={() => track('cta_signup_clicked', { source: 'landing_hero' })}
                      >
                        Sign up
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Prefer to compare plans first?{' '}
                    <Link
                      href="/pricing"
                      className="text-cyan-400 hover:underline"
                      onClick={() => track('pricing_cta_clicked', { source: 'landing_hero_text' })}
                    >
                      See pricing
                    </Link>
                    .
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-medium text-foreground">What you get</div>
                    <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      <li>Daily Deal Digest</li>
                      <li>Lead score 0–100</li>
                      <li>Pitch/outreach templates</li>
                      <li>Trigger/event signals (funding, launches, hiring spikes, press/partnerships)</li>
                    </ul>
                  </div>

                  <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-cyan-500/10 bg-card/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 font-semibold">
                        <TrendingUp className="h-4 w-4 text-cyan-400" />
                        Daily Deal Digest
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Once a day, get a ranked shortlist of accounts and events worth acting on.
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-cyan-500/10 bg-card/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 font-semibold">
                        <Zap className="h-4 w-4 text-cyan-400" />
                        Deeper Lead Scoring
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Deterministic 0–100 scores with reasons so you know where to spend time.
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-cyan-500/10 bg-card/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 font-semibold">
                        <Shield className="h-4 w-4 text-cyan-400" />
                        Pitch Templates
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Pick a template (email, call opener, LinkedIn DM) and generate a pitch you can send.
                      </p>
                    </CardContent>
                  </Card>
                </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <OneMinuteDemo />
              <div className="space-y-4">
                <div id="try-sample" className="scroll-mt-24">
                  <TrySampleDigest />
                </div>
                <Card className="border-cyan-500/10 bg-card/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Signals included</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Funding</Badge>
                      <Badge variant="outline">Product launches</Badge>
                      <Badge variant="outline">Hiring spikes</Badge>
                      <Badge variant="outline">Press / partnerships</Badge>
                      <Badge variant="outline">Other trigger events</Badge>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Signals are provider-backed and configurable. This list is illustrative, not exhaustive.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="scroll-mt-24">
              <div className="max-w-5xl">
                <h3 className="text-2xl font-bold">How LeadIntel works</h3>
                <p className="text-muted-foreground mt-2 max-w-3xl">
                  A tight loop that turns signals into action — without the tab chaos.
                </p>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-cyan-500/10 bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-base">1) Connect & choose your ICP</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Tell us what you sell and who you sell to. LeadIntel uses it to prioritize the right accounts.
                    </CardContent>
                  </Card>
                  <Card className="border-cyan-500/10 bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-base">2) We monitor, score, and summarize</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      We ingest trigger events, score leads 0–100, and roll it into a Daily Deal Digest.
                    </CardContent>
                  </Card>
                  <Card className="border-cyan-500/10 bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-base">3) You send better pitches faster</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Pick a template (short email, call opener, LinkedIn DM) and generate a pitch with “why now” context.
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>

            {/* Sample digest */}
            <section id="sample-digest" className="scroll-mt-24">
              <div className="max-w-5xl">
                <h3 className="text-2xl font-bold">Daily Deal Digest (sample)</h3>
                <p className="text-muted-foreground mt-2 max-w-3xl">
                  Turn trigger events into a focused list you can act on today.
                </p>
                <Card className="mt-6 border-cyan-500/20 bg-card/50">
                  <CardContent className="pt-6">
                    <pre className="text-xs md:text-sm whitespace-pre-wrap font-mono text-muted-foreground">
{`LeadIntel Daily Digest (Sample)
High-priority leads: 2
Trigger events (7d): 6

- Acme Logistics (acme.com) — score 84/100
  • 2026-01-22: Raises Series A to expand outbound [funding, score=92]
  • 2026-01-21: Launches new enterprise product tier [product_launch, score=78]

- Northwind Security (northwind.io) — score 73/100
  • 2026-01-20: Partners with a major cloud provider [partnership, score=74]

Open LeadIntel to take action.`}
                    </pre>
                  </CardContent>
                </Card>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Button asChild size="lg">
                    <Link href="/signup?redirect=/dashboard">Start free</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/pricing">See pricing</Link>
                  </Button>
                </div>
              </div>
            </section>

            {/* Pricing preview + ROI */}
            <section className="scroll-mt-24">
              <div className="max-w-6xl">
                <h3 className="text-2xl font-bold">Pricing</h3>
                <p className="text-muted-foreground mt-2 max-w-3xl">
                  Premium, ROI-focused outbound — built to save hours and create pipeline.
                </p>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-cyan-500/10 bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-xl">Starter (Free)</CardTitle>
                      <p className="text-3xl font-bold">$0</p>
                      <p className="text-sm text-muted-foreground">Kick the tires with basic pitches.</p>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                      <p>• Basic pitch generation</p>
                      <p>• Limited scoring and signals</p>
                      <p>• Upgrade any time</p>
                    </CardContent>
                  </Card>
                  <Card className="border-cyan-500/30 bg-card/80">
                    <CardHeader>
                      <CardTitle className="text-xl">Closer</CardTitle>
                      <p className="text-3xl font-bold">$79<span className="text-base text-muted-foreground"> / month</span></p>
                      <p className="text-sm text-muted-foreground">
                        For solo reps who want a daily deal shortlist and templates that convert.
                      </p>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                      <p>• Daily Deal Digest email with ranked accounts</p>
                      <p>• Lead scoring (0–100) with reasons</p>
                      <p>• AI pitch templates (email, call opener, LinkedIn DM)</p>
                      <p>• Monitor more accounts and trigger events</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-10">
                  <h4 className="text-xl font-bold">One meeting pays for the month.</h4>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>• Stop spraying sequences at cold lists — focus on accounts with real buying signals.</p>
                    <p>• Spend mornings in your inbox and on calls, not bouncing between tabs.</p>
                    <p>• Standardize winning messaging across your org with templates that convert.</p>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <Button asChild size="lg">
                    <Link href="/signup?redirect=/dashboard">Start free</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/pricing">See full pricing</Link>
                  </Button>
                </div>
              </div>
            </section>

            {/* Brand visual */}
            <div className="max-w-4xl mx-auto">
              <BrandHero />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Dashboard Stats */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold">Trigger Events</h2>
                  <p className="text-muted-foreground mt-1">Real-time B2B intelligence alerts</p>
                </div>
                <Button variant="outline" onClick={loadEvents}>
                  <Zap className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  <p className="text-muted-foreground">Loading events...</p>
                </div>
              ) : events.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No trigger events yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Generate your first AI-powered pitch to see trigger events appear here
                    </p>
                    <p className="text-sm text-muted-foreground">Use the pitch generator on the right to get started</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => (
                    <TriggerEventCard key={event.id} event={event} onGeneratePitch={handleGeneratePitch} />
                  ))}
                </div>
              )}

              {/* Brand visual */}
              <div className="mt-10 max-w-4xl mx-auto">
                <BrandHero />
              </div>
            </div>

            {/* Right Column - Pitch Generator */}
            <div className="space-y-6">
              <PitchGenerator />

              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Events Today</p>
                    <p className="text-2xl font-bold">{quickStats?.eventsToday ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Monitors</p>
                    <p className="text-2xl font-bold">{quickStats?.activeMonitors ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pitches Generated</p>
                    <p className="text-2xl font-bold">{quickStats?.pitchesGenerated ?? 0}</p>
                  </div>
                  {quickStats && quickStats.eventsToday === 0 && quickStats.activeMonitors === 0 && quickStats.pitchesGenerated === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No activity yet — start by generating your first pitch.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

