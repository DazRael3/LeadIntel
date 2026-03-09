export type OnboardingGoalKey =
  | 'track_target_accounts'
  | 'generate_outreach_faster'
  | 'build_daily_shortlist'
  | 'evaluate_competitive_accounts'

export type OnboardingWorkflowKey = 'pitch' | 'report' | 'daily_shortlist'

export type OnboardingStep = 1 | 2 | 3 | 4 | 5

export type OnboardingState = {
  goal: OnboardingGoalKey | null
  workflow: OnboardingWorkflowKey | null
  step: OnboardingStep
  completed: boolean
}

export type OnboardingSignals = {
  targetsCount: number
  pitchesCount: number
  reportsCount: number
  hasViewedScoringExplainer: boolean
  hasSavedBrief: boolean
  hasViewedPricing: boolean
  hasViewedTrust: boolean
}

export function normalizeGoalKey(input: unknown): OnboardingGoalKey | null {
  if (
    input === 'track_target_accounts' ||
    input === 'generate_outreach_faster' ||
    input === 'build_daily_shortlist' ||
    input === 'evaluate_competitive_accounts'
  ) {
    return input
  }
  return null
}

export function normalizeWorkflowKey(input: unknown): OnboardingWorkflowKey | null {
  if (input === 'pitch' || input === 'report' || input === 'daily_shortlist') return input
  return null
}

export function clampStep(input: unknown): OnboardingStep {
  const n = typeof input === 'number' ? input : Number.NaN
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n
  return 1
}

export function deriveOnboardingStep(state: { goal: OnboardingGoalKey | null; workflow: OnboardingWorkflowKey | null }, signals: OnboardingSignals): OnboardingStep {
  if (!state.goal) return 1
  if (signals.targetsCount <= 0) return 2
  if (!state.workflow) return 3

  // First result: at least one asset generated in the chosen workflow.
  if (state.workflow === 'pitch') {
    if (signals.pitchesCount <= 0) return 4
  } else if (state.workflow === 'report') {
    if (signals.reportsCount <= 0) return 4
  } else {
    // Daily shortlist: treat "targets exist" as enough to show the shortlist surface;
    // the next step becomes action/ops rather than generation.
    // Still keep step 4 as the guided entry point into the dashboard loop.
    return 4
  }

  return 5
}

export function defaultOnboardingState(args: {
  goal: unknown
  workflow: unknown
  step: unknown
  completed: boolean
  signals: OnboardingSignals
}): OnboardingState {
  const goal = normalizeGoalKey(args.goal)
  const workflow = normalizeWorkflowKey(args.workflow)
  const derived = deriveOnboardingStep({ goal, workflow }, args.signals)
  const persisted = clampStep(args.step)
  const step = persisted < derived ? derived : persisted

  return {
    goal,
    workflow,
    step,
    completed: Boolean(args.completed),
  }
}

