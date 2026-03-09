'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import { defaultOnboardingState, type OnboardingSignals, type OnboardingState } from '@/lib/onboarding/model'
import { track } from '@/lib/analytics'

type SampleTarget = { leadId: string; companyName: string | null; companyDomain: string | null; companyUrl: string | null }

export function OnboardingClient(props: {
  initial: {
    onboardingCompleted: boolean
    primaryGoal: string | null
    onboardingV2Step: number | null
    onboardingWorkflow: string | null
    onboardingStartedAt: string | null
    signals: Pick<OnboardingSignals, 'targetsCount' | 'pitchesCount' | 'reportsCount' | 'hasSavedBrief'>
    sampleTarget: SampleTarget | null
  }
}) {
  const router = useRouter()
  const sp = useSearchParams()

  const [signals, setSignals] = useState<OnboardingSignals>({
    targetsCount: props.initial.signals.targetsCount,
    pitchesCount: props.initial.signals.pitchesCount,
    reportsCount: props.initial.signals.reportsCount,
    hasSavedBrief: props.initial.signals.hasSavedBrief,
    hasViewedPricing: false,
    hasViewedTrust: false,
    hasViewedScoringExplainer: false,
  })

  const state: OnboardingState = useMemo(() => {
    return defaultOnboardingState({
      goal: props.initial.primaryGoal,
      workflow: props.initial.onboardingWorkflow,
      step: props.initial.onboardingV2Step,
      completed: props.initial.onboardingCompleted,
      signals,
    })
  }, [props.initial.onboardingCompleted, props.initial.onboardingV2Step, props.initial.onboardingWorkflow, props.initial.primaryGoal, signals])

  const prefillTargets = useMemo(() => {
    const from = sp.get('from')?.trim() ?? ''
    const company = sp.get('company')?.trim() ?? ''
    const domain = sp.get('domain')?.trim() ?? ''
    const url = sp.get('url')?.trim() ?? ''

    const out: string[] = []
    if (company) out.push(company)
    else if (domain) out.push(domain)
    else if (url) out.push(url)

    return { from, text: out.length > 0 ? out.join('\n') : null }
  }, [sp])

  useEffect(() => {
    // Ensure lifecycle/settings rows exist; this endpoint is idempotent.
    void fetch('/api/lifecycle/ensure', { method: 'POST' }).catch(() => {})
  }, [])

  useEffect(() => {
    track('onboarding_started', { surface: 'onboarding_page', from: prefillTargets.from || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start event once per mount
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold bloomberg-font neon-cyan">Onboarding</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A guided path to first value: targets → why-now → send-ready outreach → operational handoff.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.completed ? (
            <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-300">
              Completed
            </Badge>
          ) : (
            <Badge variant="outline">In progress</Badge>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </div>
      </div>

      {state.completed ? (
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">You’re set up</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div>
              You can revisit onboarding any time. The fastest loop is: shortlist → explain → draft → action.
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                size="sm"
                className="neon-border hover:glow-effect"
                onClick={() => {
                  track('dashboard_activation_checklist_viewed', { source: 'onboarding_complete_cta' })
                  router.push('/dashboard')
                }}
              >
                Go to command center
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSignals((prev) => ({ ...prev, hasViewedPricing: true }))
                  track('upgrade_cta_viewed', { source: 'onboarding_complete_secondary' })
                  router.push('/pricing')
                }}
              >
                Review plans
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <OnboardingFlow
          initialState={state}
          prefillTargetsText={prefillTargets.text}
          sampleTarget={props.initial.sampleTarget}
          signals={signals}
          onSignalsChange={setSignals}
          onCompleted={() => router.push('/dashboard')}
        />
      )}
    </div>
  )
}

