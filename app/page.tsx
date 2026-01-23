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
import { TopNav } from "@/components/TopNav"
import { formatErrorMessage } from "@/lib/utils/format-error"

export default function Dashboard() {
  const [events, setEvents] = useState<TriggerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro'>('free')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
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
      const normalizedEvents: TriggerEvent[] = (data || []).map((row) => ({
        id: row.id,
        company_name: row.company_name || 'Unknown Company',
        event_type: row.event_type || 'expansion',
        event_description: row.event_description || '',
        source_url: row.source_url || '',
        detected_at: row.detected_at || row.created_at || new Date().toISOString(),
        company_url: row.company_url,
        company_domain: row.company_domain,
        headline: row.headline,
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
      const { data: { user } } = await supabase.auth.getUser()
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
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        const loggedIn = !!user
        setIsLoggedIn(loggedIn)

        // Only load tenant-scoped data when authenticated.
        if (loggedIn) {
          loadEvents()
          checkSubscription()
        } else {
          setLoading(false)
          setEvents([])
          setSubscriptionTier('free')
        }
      } catch {
        if (!cancelled) {
          setIsLoggedIn(false)
          setLoading(false)
          setEvents([])
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [supabase, loadEvents, checkSubscription])

  const handleGeneratePitch = (companyUrl: string, companyName: string) => {
    router.push(`/pitch?url=${encodeURIComponent(companyUrl)}&name=${encodeURIComponent(companyName)}`)
  }

  const handleUpgrade = () => {
    router.push('/pricing')
  }

  const handleLogin = () => {
    router.push('/login?mode=signin&redirect=/dashboard')
  }

  const handleSignup = () => {
    router.push('/login?mode=signup&redirect=/dashboard')
  }

  const handleDashboard = () => {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
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
                  <Button variant="outline" onClick={handleLogin} size="sm">
                    Log in
                  </Button>
                  <Button onClick={handleSignup} size="sm">
                    Sign up
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={handleDashboard} size="sm">
                  Command Center
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
                <Button onClick={handleUpgrade} size="sm">
                  Upgrade to Pro
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Dashboard Stats */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">Trigger Events</h2>
                <p className="text-muted-foreground mt-1">
                  Real-time B2B intelligence alerts
                </p>
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
                  <p className="text-sm text-muted-foreground">
                    Use the pitch generator on the right to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <TriggerEventCard
                    key={event.id}
                    event={event}
                    onGeneratePitch={handleGeneratePitch}
                  />
                ))}
              </div>
            )}
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
                  <p className="text-2xl font-bold">{events.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Monitors</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pitches Generated</p>
                  <p className="text-2xl font-bold">47</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
