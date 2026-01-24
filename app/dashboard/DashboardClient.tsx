'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, DollarSign, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { MarketPulse } from '@/components/MarketPulse'
import { MarketPulseTicker } from '@/components/MarketPulseTicker'
import { LeadLibrary } from '@/components/LeadLibrary'
import { WebsiteVisitors } from '@/components/WebsiteVisitors'
import { LiveIntent } from '@/components/LiveIntent'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { Watchlist } from '@/components/Watchlist'
import { DashboardHeader } from '@/components/DashboardHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePlan } from '@/components/PlanProvider'
import { useTriggerEvents } from './hooks/useTriggerEvents'
import { useCredits } from './hooks/useCredits'
import { useStats } from './hooks/useStats'
import { useOnboarding } from './hooks/useOnboarding'
import { useDebugInfo } from './hooks/useDebugInfo'
import { DashboardHeaderSection } from './components/DashboardHeaderSection'
import { StatsBar } from './components/StatsBar'
import { TriggerEventsSection } from './components/TriggerEventsSection'
import { DebugPanel } from './components/DebugPanel'
import { ViewModeToggle } from './components/ViewModeToggle'
import { ProOnlyCard } from './components/ProOnlyCard'

interface DashboardClientProps {
  initialSubscriptionTier: 'free' | 'pro'
  initialCreditsRemaining: number
  initialOnboardingCompleted: boolean
  initialAutopilotEnabled: boolean
}

export function DashboardClient({ 
  initialSubscriptionTier, 
  initialCreditsRemaining, 
  initialOnboardingCompleted,
  initialAutopilotEnabled
}: DashboardClientProps) {
  const [isPro, setIsPro] = useState(initialSubscriptionTier === 'pro')
  const [viewMode, setViewMode] = useState<'startup' | 'enterprise'>('startup')
  const [autopilotEnabled, setAutopilotEnabled] = useState<boolean>(initialAutopilotEnabled)
  const [autopilotSaving, setAutopilotSaving] = useState<boolean>(false)
  const router = useRouter()
  const { isPro: planIsPro } = usePlan()
  const isDev = process.env.NODE_ENV !== 'production'

  // Data fetching hooks
  const { events, loading: eventsLoading, error: eventsError, loadEvents } = useTriggerEvents()
  const { creditsRemaining, loading: creditsLoading, loadCredits } = useCredits(initialCreditsRemaining, initialSubscriptionTier === 'pro')
  const { totalLeads, loadStats } = useStats()
  const { showOnboarding, onboardingComplete, onboardingChecked, handleOnboardingComplete } = useOnboarding(initialOnboardingCompleted)
  const { debugInfo, showDebug, checkWhoami, hideDebug } = useDebugInfo()

  // Sync isPro state with plan hook
  useEffect(() => {
    setIsPro(planIsPro)
    if (planIsPro) {
      loadCredits(true)
    }
  }, [planIsPro, loadCredits])

  // Initial data load
  useEffect(() => {
    loadCredits(planIsPro)
    loadStats()
    loadEvents()
  }, [loadCredits, loadStats, loadEvents, planIsPro])

  const loading = creditsLoading

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <DashboardHeader />
      {/* Onboarding Wizard - Only show if server says not completed */}
      {onboardingChecked && showOnboarding && !onboardingComplete && !initialOnboardingCompleted && !planIsPro && (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      )}

      {/* Market Pulse Ticker */}
      <MarketPulseTicker />

      {/* Header */}
      <DashboardHeaderSection isPro={isPro} creditsRemaining={creditsRemaining} />

      {/* Debug Panel - Only in dev mode */}
      {isDev && showDebug && debugInfo && (
        <DebugPanel debugInfo={debugInfo} onClose={hideDebug} />
      )}

      {/* Stats Bar */}
      <StatsBar 
        totalLeads={totalLeads} 
        eventsCount={events.length} 
        isPro={isPro} 
        isDev={isDev}
        onDebugClick={checkWhoami}
      />

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        {/* Trigger Events Section */}
        <TriggerEventsSection 
          events={events}
          loading={eventsLoading}
          error={eventsError}
          onRefresh={loadEvents}
        />

        <Tabs defaultValue="leads" className="space-y-6">
          <TabsList className="bg-background/50 border border-cyan-500/20">
            <TabsTrigger value="leads" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
              Lead Library
            </TabsTrigger>
            <TabsTrigger value="visitors" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
              Website Visitors
            </TabsTrigger>
            <TabsTrigger value="live-intent" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400">
              Live Intent
              {!isPro && (
                <Badge variant="outline" className="ml-2 border-purple-500/30 text-purple-400 bg-purple-500/10 text-xs h-4 px-1">
                  Pro
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="market" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
              Market Pulse
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400">
              Watchlist
              {!isPro && (
                <Badge variant="outline" className="ml-2 border-purple-500/30 text-purple-400 bg-purple-500/10 text-xs h-4 px-1">
                  Pro
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="space-y-6">
            {/* View Mode Toggle */}
            <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Market Pulse */}
              <div className="lg:col-span-1">
                <MarketPulse />
              </div>

              {/* Right Column - Lead Library */}
              <div className="lg:col-span-2">
                {loading ? (
                  <Card className="border-cyan-500/20 bg-card/50">
                    <CardContent className="py-20 text-center">
                      <Activity className="h-16 w-16 mx-auto mb-4 text-cyan-400 animate-pulse" />
                      <p className="text-muted-foreground uppercase tracking-wider">Loading Intelligence...</p>
                    </CardContent>
                  </Card>
                ) : (
                  <LeadLibrary isPro={isPro} creditsRemaining={creditsRemaining} viewMode={viewMode} />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="visitors" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <MarketPulse />
              </div>
              <div className="lg:col-span-2">
                <WebsiteVisitors />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="live-intent" className="space-y-6">
            {isPro ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <MarketPulse />
                </div>
                <div className="lg:col-span-2">
                  <LiveIntent isPro={isPro} />
                </div>
              </div>
            ) : (
              <ProOnlyCard
                title="Live Intent is Pro-only"
                description="Upgrade to Pro to unlock real-time intent signals and enrichment."
                icon="shield"
                iconColor="cyan"
              />
            )}
          </TabsContent>

          <TabsContent value="market" className="space-y-6">
            <MarketPulse />
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-6">
            {isPro ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <MarketPulse />
                </div>
                <div className="lg:col-span-2">
                  <Watchlist isPro={isPro} />
                </div>
              </div>
            ) : (
              <ProOnlyCard
                title="Watchlist is Pro-only"
                description="Save leads and track changes with Watchlist when you upgrade."
                icon="lock"
                iconColor="purple"
              />
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="border-cyan-500/20 bg-card/50">
              <CardContent className="py-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Autopilot</h3>
                    <p className="text-sm text-muted-foreground">
                      Enable scheduled outreach for your tenant (cron-triggered).
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={autopilotEnabled}
                      disabled={autopilotSaving}
                      onChange={async (e) => {
                        const next = e.target.checked
                        setAutopilotSaving(true)
                        try {
                          const res = await fetch('/api/settings/autopilot', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ enabled: next }),
                          })
                          if (res.ok) {
                            setAutopilotEnabled(next)
                          } else {
                            // Keep UI stable; no secret logging.
                            setAutopilotEnabled((prev) => prev)
                          }
                        } finally {
                          setAutopilotSaving(false)
                        }
                      }}
                    />
                    <span>{autopilotEnabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>
                {!isPro && (
                  <div className="text-sm text-muted-foreground">
                    Autopilot is a Pro feature. Upgrade to enable scheduled sending.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Value Proposition Banner for Free Users */}
        {!isPro && creditsRemaining === 0 && (
          <Card className="mt-6 border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-2">Credits Exhausted</h3>
                  <p className="text-sm text-muted-foreground">
                    You&apos;ve used your daily free lead. Upgrade to Pro for unlimited access to all leads with full contact details.
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/pricing')}
                  className="neon-border hover:glow-effect bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
