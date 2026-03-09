'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { track } from '@/lib/analytics'
import { parseTargetsFromText } from '@/lib/onboarding/targets'
import type { OnboardingGoalKey, OnboardingSignals, OnboardingState, OnboardingStep, OnboardingWorkflowKey } from '@/lib/onboarding/model'

const MAX_TARGETS = 50

const GOALS: Array<{ key: OnboardingGoalKey; label: string; helper: string }> = [
  { key: 'track_target_accounts', label: 'Track target accounts', helper: 'Monitor accounts you care about and keep the why-now context attached.' },
  { key: 'generate_outreach_faster', label: 'Generate outreach faster', helper: 'Turn fresh signals into send-ready openers with less blank-page work.' },
  { key: 'build_daily_shortlist', label: 'Build a daily shortlist', helper: 'Start each day with a reasoned list of accounts to action.' },
  { key: 'evaluate_competitive_accounts', label: 'Evaluate competitive accounts', helper: 'Generate citation-backed competitive reports you can share and reuse.' },
] as const

const WORKFLOWS: Array<{ key: OnboardingWorkflowKey; label: string; helper: string }> = [
  { key: 'pitch', label: 'Pitch workflow', helper: 'Generate signal-grounded outreach drafts you can send immediately.' },
  { key: 'report', label: 'Report workflow', helper: 'Generate a sourced competitive report and save it to Reports.' },
  { key: 'daily_shortlist', label: 'Daily shortlist workflow', helper: 'Run the daily loop: shortlist → explain → draft → action.' },
] as const

type SampleTarget = { leadId: string; companyName: string | null; companyDomain: string | null; companyUrl: string | null }

async function saveSettings(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

function pickTargetInput(sampleTarget: SampleTarget | null, fallback: string | null): string {
  const url = (sampleTarget?.companyUrl ?? '').trim()
  if (url) return url
  const domain = (sampleTarget?.companyDomain ?? '').trim()
  if (domain) return domain
  const name = (sampleTarget?.companyName ?? '').trim()
  if (name) return name
  return (fallback ?? '').trim()
}

export function OnboardingFlow(props: {
  initialState: OnboardingState
  prefillTargetsText: string | null
  sampleTarget: SampleTarget | null
  signals: OnboardingSignals
  onSignalsChange: (next: OnboardingSignals) => void
  onCompleted: () => void
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep] = useState<OnboardingStep>(props.initialState.step)
  const [goal, setGoal] = useState<OnboardingGoalKey | null>(props.initialState.goal)
  const [workflow, setWorkflow] = useState<OnboardingWorkflowKey | null>(props.initialState.workflow)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [targetsText, setTargetsText] = useState(props.prefillTargetsText ?? '')
  const [firstResultInput, setFirstResultInput] = useState(() => pickTargetInput(props.sampleTarget, props.prefillTargetsText))

  useEffect(() => {
    // Keep local step in sync when server-derived signals push us forward.
    if (props.initialState.step > step) setStep(props.initialState.step)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally compare once on mount
  }, [])

  const progress = useMemo(() => {
    const total = 5
    return { current: step, total }
  }, [step])

  const persistProgress = useCallback(
    async (next: { step?: OnboardingStep; goal?: OnboardingGoalKey | null; workflow?: OnboardingWorkflowKey | null; completed?: boolean }) => {
      setSaving(true)
      setError(null)
      try {
        const nowIso = new Date().toISOString()
        const payload: Record<string, unknown> = {
          onboarding_completed: next.completed ?? false,
          onboarding_v2_step: next.step ?? step,
          ...(next.goal ? { primary_goal: next.goal } : {}),
          ...(next.workflow ? { onboarding_workflow: next.workflow } : {}),
          onboarding_started_at: nowIso,
        }
        const ok = await saveSettings(payload)
        if (!ok) {
          setError('Unable to save onboarding progress. Please try again.')
          return false
        }
        return true
      } finally {
        setSaving(false)
      }
    },
    [step]
  )

  async function handleSkip() {
    track('onboarding_completed', { skipped: true })
    const ok = await persistProgress({ completed: true, step })
    if (ok) props.onCompleted()
  }

  async function handleChooseGoal(nextGoal: OnboardingGoalKey) {
    setGoal(nextGoal)
    track('onboarding_goal_selected', { goal: nextGoal })
    const ok = await persistProgress({ goal: nextGoal, step: 2 })
    if (ok) setStep(2)
  }

  async function handleAddTargets() {
    const parsed = parseTargetsFromText(targetsText, MAX_TARGETS)
    if (parsed.length === 0) {
      setError('Add at least one company name, domain, or URL.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const user = await getUserSafe(supabase)
      if (!user) {
        router.push('/login?mode=signin&redirect=/onboarding')
        return
      }

      const rows = parsed.map((p) => ({
        user_id: user.id,
        company_name: p.domain ? null : p.name,
        company_domain: p.domain,
        company_url: p.url,
        ai_personalized_pitch: null,
      }))

      const { error: upsertError } = await supabase.from('leads').upsert(rows, { onConflict: 'user_id,company_domain' })
      if (upsertError) {
        setError('Unable to add targets. Please try again.')
        return
      }

      track('target_accounts_added', { count: parsed.length })
      props.onSignalsChange({ ...props.signals, targetsCount: Math.max(props.signals.targetsCount, parsed.length) })
      setFirstResultInput(pickTargetInput(props.sampleTarget, parsed[0]?.url ?? parsed[0]?.domain ?? parsed[0]?.name ?? null))
      const ok = await persistProgress({ step: 3 })
      if (ok) setStep(3)
    } finally {
      setSaving(false)
    }
  }

  async function handleChooseWorkflow(next: OnboardingWorkflowKey) {
    setWorkflow(next)
    track('onboarding_workflow_selected', { workflow: next })
    const ok = await persistProgress({ workflow: next, step: 4 })
    if (ok) setStep(4)
  }

  async function handleGoFirstResult() {
    const input = firstResultInput.trim()
    if (!workflow) return
    if (!input) {
      setError('Enter a company domain or website URL to generate your first result.')
      return
    }

    // Persist step advancement before leaving the page.
    await persistProgress({ step: 5 })

    if (workflow === 'pitch') {
      track('first_pitch_preview_generated', { source: 'onboarding' })
      router.push(`/pitch?auto=1&url=${encodeURIComponent(input)}`)
      return
    }
    if (workflow === 'report') {
      track('first_report_preview_generated', { source: 'onboarding' })
      router.push(`/competitive-report/new?auto=1&url=${encodeURIComponent(input)}`)
      return
    }

    track('dashboard_activation_checklist_viewed', { source: 'onboarding_daily_shortlist' })
    router.push('/dashboard')
  }

  async function handleFinish() {
    track('onboarding_completed', { skipped: false })
    const ok = await persistProgress({ completed: true, step: 5 })
    if (ok) props.onCompleted()
  }

  const stepLabel = useMemo(() => {
    if (step === 1) return 'Choose goal'
    if (step === 2) return 'Add targets'
    if (step === 3) return 'Pick workflow'
    if (step === 4) return 'First result'
    return 'Next action'
  }, [step])

  const showBack = step > 1 && step < 5

  return (
    <Card className="border-cyan-500/20 bg-card/60" data-testid="onboarding-flow">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{stepLabel}</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              Step {progress.current} of {progress.total}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {goal ? <Badge variant="outline">Goal set</Badge> : <Badge variant="outline">Goal pending</Badge>}
            {props.signals.targetsCount > 0 ? <Badge variant="outline">{props.signals.targetsCount} targets</Badge> : <Badge variant="outline">No targets</Badge>}
            <Button size="sm" variant="outline" onClick={handleSkip} disabled={saving}>
              Skip for now
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>
        ) : null}

        {step === 1 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {GOALS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => void handleChooseGoal(g.key)}
                className="text-left rounded-lg border border-cyan-500/20 bg-background/40 p-4 hover:border-cyan-500/40 transition"
                disabled={saving}
              >
                <div className="text-sm font-semibold text-foreground">{g.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{g.helper}</div>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Add a few targets now. Domains/URLs unlock stronger first-party intent matching, but company names are OK to start.
            </div>
            <div className="space-y-2">
              <Label htmlFor="targets">Company names, domains, or URLs</Label>
              <Textarea
                id="targets"
                className="min-h-[160px] bg-background"
                value={targetsText}
                onChange={(e) => setTargetsText(e.target.value)}
                placeholder={'acme.com\nnorthwind.com\nContoso'}
                disabled={saving}
              />
              <div className="text-xs text-muted-foreground">Up to {MAX_TARGETS} targets. Paste one per line or comma-separated.</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="neon-border hover:glow-effect" onClick={() => void handleAddTargets()} disabled={saving}>
                Add targets
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  track('onboarding_targets_skipped', { goal })
                  // Guided sample path: proceed without saving targets; step 3 still applies.
                  const ok = await persistProgress({ step: 3 })
                  if (ok) setStep(3)
                }}
                disabled={saving}
              >
                Skip targets (guided)
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Pick the workflow you want to reach first value with. You can switch later.
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {WORKFLOWS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => void handleChooseWorkflow(w.key)}
                  className="text-left rounded-lg border border-cyan-500/20 bg-background/40 p-4 hover:border-cyan-500/40 transition"
                  disabled={saving}
                >
                  <div className="text-sm font-semibold text-foreground">{w.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{w.helper}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Generate your first result. This is a preview workflow—no need to set up integrations or import contacts.
            </div>
            <div className="space-y-2">
              <Label htmlFor="first_result_company">Company domain or URL</Label>
              <Input
                id="first_result_company"
                value={firstResultInput}
                onChange={(e) => setFirstResultInput(e.target.value)}
                placeholder="acme.com or https://acme.com"
                disabled={saving}
              />
              <div className="text-xs text-muted-foreground">
                Use a domain for strongest first-party matching. We won’t fabricate activity if it isn’t present.
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="neon-border hover:glow-effect" onClick={() => void handleGoFirstResult()} disabled={saving || !workflow}>
                {workflow === 'report' ? 'Generate competitive report' : workflow === 'daily_shortlist' ? 'Open command center' : 'Generate pitch preview'}
              </Button>
              <Button asChild variant="outline" disabled={saving}>
                <Link href="/how-scoring-works" onClick={() => track('first_scoring_explainer_viewed', { source: 'onboarding' })}>
                  Review scoring method
                </Link>
              </Button>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-cyan-500/20 bg-background/40 p-4 space-y-2">
              <div className="text-sm font-semibold text-foreground">Next best action</div>
              <div className="text-sm text-muted-foreground">
                Keep the loop tight: generate → save → action. When you’re ready, unlock the full workspace and saved outputs.
              </div>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  className="neon-border hover:glow-effect"
                  onClick={() => {
                    if (workflow === 'report') router.push('/competitive-report/new')
                    else router.push('/pitch')
                  }}
                >
                  Generate another preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    props.onSignalsChange({ ...props.signals, hasViewedPricing: true })
                    track('upgrade_cta_clicked', { source: 'onboarding_next_action' })
                    router.push('/pricing')
                  }}
                >
                  View pricing
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    props.onSignalsChange({ ...props.signals, hasViewedTrust: true })
                    track('trust_center_cta_clicked', { source: 'onboarding_next_action' })
                    router.push('/trust')
                  }}
                >
                  Review trust/security
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="neon-border hover:glow-effect" onClick={() => void handleFinish()} disabled={saving}>
                Finish onboarding
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')} disabled={saving}>
                Go to dashboard
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between pt-2 border-t border-cyan-500/10">
          {showBack ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              disabled={saving}
              onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as OnboardingStep) : prev))}
            >
              Back
            </Button>
          ) : (
            <div />
          )}
          <div className="text-xs text-muted-foreground">
            Prefer exploring first? You can always generate a preview from{' '}
            <Link className="text-cyan-400 hover:underline" href="/pitch">
              Pitch
            </Link>{' '}
            or{' '}
            <Link className="text-cyan-400 hover:underline" href="/competitive-report/new">
              Reports
            </Link>
            .
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

