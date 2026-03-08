'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmailShield } from "@/components/EmailShield"
import { BattleCard } from "@/components/BattleCard"
import { SocialWarmer } from "@/components/SocialWarmer"
import { EmailSequence } from "@/components/EmailSequence"
import { UpgradeOverlay } from "@/components/UpgradeOverlay"
import { Mail, Linkedin, Copy, Check, X, Send, Loader2, TrendingUp, Lock } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { Lead } from "@/lib/supabaseClient"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { formatErrorMessage } from "@/lib/utils/format-error"
import { getUserSafe } from "@/lib/supabase/safe-auth"
import { SignalsPanel, type SignalsPanelSort, type SignalsPanelWindow } from "@/components/account/SignalsPanel"
import { ScoreExplainer } from "@/components/account/ScoreExplainer"
import { SignalMomentumCard } from "@/components/account/SignalMomentumCard"
import { FirstPartyIntentCard } from "@/components/account/FirstPartyIntentCard"
import { AccountBriefCard } from "@/components/account/AccountBriefCard"
import { AccountActionCenter } from "@/components/account/AccountActionCenter"
import type { FirstPartyIntent, SignalEvent, SignalMomentum, ScoreExplainability } from "@/lib/domain/explainability"
import type { BuyingGroupRecommendation, PersonaRecommendationSummary } from "@/lib/domain/people"
import { deriveFirstPartyIntentSummary } from "@/lib/services/first-party-intent"
import { RecommendedPeopleCard } from "@/components/account/RecommendedPeopleCard"
import { BuyingGroupCard } from "@/components/account/BuyingGroupCard"
import { SignalMomentumTimeline } from "@/components/account/SignalMomentumTimeline"

interface LeadDetailViewProps {
  lead: Lead
  isPro: boolean
  onClose: () => void
}

type ExplainabilityEnvelope =
  | {
      ok: true
      data: {
        signals: SignalEvent[]
        scoreExplainability: ScoreExplainability
        momentum: SignalMomentum
        firstPartyIntent: FirstPartyIntent
        people: { personas: PersonaRecommendationSummary; buyingGroup: BuyingGroupRecommendation }
      }
    }
  | { ok: false; error?: { message?: string } }

const EMPTY_VISITOR_MATCHES = { count: 0, lastVisitedAt: null, sampleReferrers: [] as string[] }

export function LeadDetailView({ lead, isPro, onClose }: LeadDetailViewProps) {
  const router = useRouter()
  const supabase = createClient()
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [userSettings, setUserSettings] = useState<{ whatYouSell?: string; idealCustomer?: string } | null>(null)
  const [unlocked, setUnlocked] = useState(isPro) // Pro users are always unlocked
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [signalsWindow, setSignalsWindow] = useState<SignalsPanelWindow>('30d')
  const [signalsSort, setSignalsSort] = useState<SignalsPanelSort>('recent')
  const [signalsType, setSignalsType] = useState<string | null>(null)
  const [briefRefreshKey, setBriefRefreshKey] = useState(0)
  const [explainability, setExplainability] = useState<{
    loading: boolean
    error: string | null
    signals: SignalEvent[]
    scoreExplainability: ScoreExplainability | null
    momentum: SignalMomentum | null
    firstPartyIntent: FirstPartyIntent
    people: { personas: PersonaRecommendationSummary; buyingGroup: BuyingGroupRecommendation } | null
  }>({
    loading: true,
    error: null,
    signals: [],
    scoreExplainability: null,
    momentum: null,
    firstPartyIntent: { visitorMatches: EMPTY_VISITOR_MATCHES, summary: deriveFirstPartyIntentSummary({ visitorMatches: EMPTY_VISITOR_MATCHES }) },
    people: null,
  })

  const handleUnlockLead = async () => {
    if (isPro || unlocked) return // Pro users or already unlocked

    setUnlocking(true)
    setUnlockError(null)

    try {
      const response = await fetch('/api/unlock-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        // If unlock failed due to 24-hour rule, redirect to checkout
        if (data.redirect) {
          window.location.href = data.redirect
          return
        }
        setUnlockError(data.message || 'Failed to unlock lead')
        return
      }

      // Successfully unlocked
      setUnlocked(true)
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error)
      console.error('Error unlocking lead:', errorMessage)
      setUnlockError(errorMessage)
    } finally {
      setUnlocking(false)
    }
  }

  useEffect(() => {
    // Load user settings for personalization
    const loadUserSettings = async () => {
      try {
        const user = await getUserSafe(supabase)
        if (user) {
          const { data } = await supabase
            .from('user_settings')
            .select('what_you_sell, ideal_customer')
            .eq('user_id', user.id)
            .single()
          if (data) {
            setUserSettings({
              whatYouSell: typeof (data as { what_you_sell?: unknown }).what_you_sell === 'string' ? (data as { what_you_sell: string }).what_you_sell : undefined,
              idealCustomer:
                typeof (data as { ideal_customer?: unknown }).ideal_customer === 'string' ? (data as { ideal_customer: string }).ideal_customer : undefined,
            })
          }
        }
      } catch (error) {
        console.error('[LeadDetailView] Error loading user settings', { message: formatErrorMessage(error) })
      }
    }
    loadUserSettings()

    // If not pro, attempt to unlock the lead
    if (!isPro && !unlocked) {
      handleUnlockLead()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadExplainability = async () => {
      setExplainability((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const qs = new URLSearchParams()
        qs.set('window', signalsWindow)
        qs.set('sort', signalsSort)
        qs.set('limit', '50')
        if (signalsType) qs.set('type', signalsType)
        const res = await fetch(`/api/accounts/${lead.id}/explainability?${qs.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
        })
        const json = (await res.json().catch(() => null)) as ExplainabilityEnvelope | null
        if (cancelled) return
        if (!res.ok || !json || json.ok !== true) {
          setExplainability({
            loading: false,
            error: 'Unable to load explainability.',
            signals: [],
            scoreExplainability: null,
            momentum: null,
            firstPartyIntent: { visitorMatches: EMPTY_VISITOR_MATCHES, summary: deriveFirstPartyIntentSummary({ visitorMatches: EMPTY_VISITOR_MATCHES }) },
            people: null,
          })
          return
        }
        setExplainability({
          loading: false,
          error: null,
          signals: Array.isArray(json.data.signals) ? json.data.signals : [],
          scoreExplainability: json.data.scoreExplainability ?? null,
          momentum: json.data.momentum ?? null,
          firstPartyIntent:
            json.data.firstPartyIntent ?? { visitorMatches: EMPTY_VISITOR_MATCHES, summary: deriveFirstPartyIntentSummary({ visitorMatches: EMPTY_VISITOR_MATCHES }) },
          people: json.data.people ?? null,
        })
      } catch (_err) {
        if (cancelled) return
        setExplainability({
          loading: false,
          error: 'Unable to load explainability.',
          signals: [],
          scoreExplainability: null,
          momentum: null,
          firstPartyIntent: { visitorMatches: EMPTY_VISITOR_MATCHES, summary: deriveFirstPartyIntentSummary({ visitorMatches: EMPTY_VISITOR_MATCHES }) },
          people: null,
        })
      }
    }

    void loadExplainability()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [lead.id, signalsWindow, signalsSort, signalsType])

  const handleCopyPitch = async () => {
    try {
      await navigator.clipboard.writeText(lead.ai_personalized_pitch)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleSendPitch = async () => {
    if (!lead.prospect_email) {
      alert('No email address available for this lead')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/send-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          recipientEmail: lead.prospect_email,
          recipientName: lead.company_name,
          companyName: lead.company_name,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send email')
      }

      setSent(true)
      setTimeout(() => setSent(false), 5000)
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error)
      console.error('Error sending pitch:', errorMessage)
      alert(errorMessage)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto border-cyan-500/30 bg-card/95">
        <CardHeader className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-cyan-500/20">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-2xl bloomberg-font neon-cyan">
                  {lead.company_name}
                </CardTitle>
                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
                  {lead.trigger_event}
                </Badge>
              </div>
              <CardDescription className="text-xs uppercase tracking-wider">
                {formatDate(lead.created_at)}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Unlock Status for Free Users */}
          {!isPro && !unlocked && (
            <div className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
              {unlocking ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
                  <p className="text-sm text-yellow-400">Unlocking lead...</p>
                </div>
              ) : unlockError ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-400">{unlockError}</p>
                  <Button
                    size="sm"
                    onClick={() => (window.location.href = '/pricing')}
                    className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs px-3 py-2 max-w-full whitespace-normal"
                  >
                    <span className="text-center">Upgrade to unlock the full signal workspace and action layer.</span>
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          {/* Contact Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400">Contact Information</h3>
            <div className="flex flex-wrap gap-4">
              {lead.prospect_email && (
                <div className="relative flex items-center gap-2 p-3 rounded-lg border border-cyan-500/10 bg-background/30">
                  <Mail className="h-4 w-4 text-cyan-400" />
                  <div className={!isPro ? 'blur-sm' : ''}>
                    <div className="text-sm font-mono">{isPro ? lead.prospect_email : '***@***.com'}</div>
                  </div>
                  {isPro && <EmailShield email={lead.prospect_email} />}
                  {!isPro && <UpgradeOverlay />}
                </div>
              )}
              {lead.prospect_linkedin && (
                <div className="relative flex items-center gap-2 p-3 rounded-lg border border-cyan-500/10 bg-background/30">
                  <Linkedin className="h-4 w-4 text-cyan-400" />
                  <a
                    href={isPro ? lead.prospect_linkedin : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-sm hover:text-cyan-400 ${!isPro ? 'blur-sm pointer-events-none' : ''}`}
                    onClick={(e) => !isPro && e.preventDefault()}
                  >
                    {isPro ? lead.prospect_linkedin : 'LinkedIn Profile'}
                  </a>
                  {!isPro && <UpgradeOverlay />}
                </div>
              )}
            </div>
          </div>

          {/* Fit Score */}
          {lead.fit_score !== undefined && (
            <div className="p-4 rounded-lg border border-green-500/10 bg-background/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-green-400">
                    Deal Score
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className={`text-lg font-bold ${
                    lead.fit_score >= 80
                      ? 'border-green-500/30 text-green-400 bg-green-500/10'
                      : lead.fit_score >= 60
                      ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                      : 'border-red-500/30 text-red-400 bg-red-500/10'
                  }`}
                >
                  {lead.fit_score}/100
                </Badge>
              </div>
              {lead.growth_signals && lead.growth_signals.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {lead.growth_signals.map((signal, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-xs"
                    >
                      {signal}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <SignalMomentumCard momentum={explainability.momentum} currentScore={explainability.scoreExplainability?.score ?? null} />

          <ScoreExplainer
            explainability={explainability.scoreExplainability}
            momentum={explainability.momentum}
            loading={explainability.loading}
          />

          <FirstPartyIntentCard
            accountId={lead.id}
            companyName={lead.company_name ?? null}
            companyDomain={lead.company_domain ?? null}
            inputUrl={lead.company_url ?? null}
            firstPartyIntent={explainability.firstPartyIntent}
          />

          {explainability.people ? (
            <>
              <RecommendedPeopleCard accountId={lead.id} personas={explainability.people.personas} />
              <BuyingGroupCard accountId={lead.id} buyingGroup={explainability.people.buyingGroup} />
            </>
          ) : null}

          <SignalMomentumTimeline accountId={lead.id} momentum={explainability.momentum} signals={explainability.signals} />

          <AccountActionCenter
            accountId={lead.id}
            companyName={lead.company_name ?? 'Unknown company'}
            window={signalsWindow}
            whyNowSummary={[
              `Account: ${lead.company_name ?? 'Unknown company'}`,
              explainability.momentum
                ? `Momentum: ${explainability.momentum.label} (${explainability.momentum.delta >= 0 ? '+' : ''}${explainability.momentum.delta})`
                : 'Momentum: —',
              ...explainability.signals.slice(0, 3).map((s) => `Signal: ${s.title}`),
            ].join('\n')}
            opener={typeof lead.ai_personalized_pitch === 'string' ? lead.ai_personalized_pitch : null}
            personas={explainability.people?.personas ?? null}
            onBriefGenerated={() => setBriefRefreshKey((x) => x + 1)}
          />

          <AccountBriefCard
            accountId={lead.id}
            companyName={lead.company_name ?? 'Unknown company'}
            companyDomain={lead.company_domain ?? null}
            inputUrl={lead.company_url ?? null}
            signalWindow={signalsWindow}
            isPro={isPro}
            refreshKey={briefRefreshKey}
          />

          <SignalsPanel
            signals={explainability.signals}
            loading={explainability.loading}
            error={explainability.error}
            window={signalsWindow}
            sort={signalsSort}
            selectedType={signalsType}
            onChangeWindow={setSignalsWindow}
            onChangeSort={setSignalsSort}
            onChangeType={setSignalsType}
            onGeneratePitchDraft={() => {
              onClose()
              const urlLike = (lead.company_url || lead.company_domain || lead.company_name || '').trim()
              const qs = new URLSearchParams()
              qs.set('auto', '1')
              if (urlLike) qs.set('url', urlLike)
              if (lead.company_name) qs.set('name', lead.company_name)
              router.push(`/pitch?${qs.toString()}`)
            }}
          />

          {/* Social Warmer */}
          {lead.prospect_linkedin && (
            <SocialWarmer
              companyName={lead.company_name}
              triggerEvent={lead.trigger_event}
              linkedinProfile={lead.prospect_linkedin}
              userSettings={userSettings ?? undefined}
            />
          )}

          {/* Battle Card - Enterprise Feature (visible but blurred for Free users) */}
          <BattleCard
            companyName={lead.company_name}
            companyUrl={lead.prospect_linkedin ? `https://${lead.company_name.toLowerCase().replace(/\s+/g, '')}.com` : undefined}
            triggerEvent={lead.trigger_event}
            isPro={isPro}
          />

          {/* Email Sequence - Enterprise Feature */}
          <EmailSequence
            companyName={lead.company_name}
            triggerEvent={lead.trigger_event}
            ceoName={null}
            companyInfo={null}
            userSettings={userSettings ?? undefined}
            isPro={isPro}
            recipientEmail={lead.prospect_email}
          />

          {/* AI Pitch - Single Email (Legacy) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400">AI Personalized Pitch (Single)</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const urlLike = (lead.company_url || lead.company_domain || lead.company_name || '').trim()
                    const qs = new URLSearchParams()
                    qs.set('auto', '1')
                    if (urlLike) qs.set('url', urlLike)
                    if (lead.company_name) qs.set('name', lead.company_name)
                    router.push(`/pitch?${qs.toString()}`)
                  }}
                  className="neon-border hover:glow-effect whitespace-nowrap"
                >
                  Generate pitch
                </Button>
                {isPro && lead.prospect_email && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSendPitch}
                    disabled={sending || sent}
                    className="neon-border hover:glow-effect bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30 whitespace-nowrap"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : sent ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Sent
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Auto-Send
                      </>
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyPitch}
                  className="neon-border hover:glow-effect whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="bg-background/50 border border-cyan-500/10 rounded-md p-4 relative">
              {!isPro && !unlocked && (
                <div className="absolute inset-0 bg-background/90 backdrop-blur-sm rounded-md border border-cyan-500/30 z-10 flex items-center justify-center">
                  <div className="text-center p-4">
                    <Lock className="h-8 w-8 mx-auto mb-3 text-cyan-400" />
                    <p className="text-sm font-bold mb-2 text-cyan-400">AI Pitch Locked</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Upgrade to unlock why-now context, send-ready drafts, and action-layer features.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => (window.location.href = '/pricing')}
                      className="neon-border hover:glow-effect bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
                    >
                      See pricing
                    </Button>
                  </div>
                </div>
              )}
              <p className={`text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground ${!isPro && !unlocked ? 'blur-sm select-none' : ''}`}>
                {isPro || unlocked
                  ? lead.ai_personalized_pitch
                  : 'Pitch content is locked. Upgrade to unlock why-now context, send-ready drafts, and action layer features.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
