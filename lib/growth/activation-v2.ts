export type ActivationV2StepId =
  | 'target_accounts_added'
  | 'first_pitch_preview_generated'
  | 'first_report_preview_generated'
  | 'first_scoring_explainer_viewed'
  | 'templates_viewed'
  | 'pricing_reviewed'
  | 'trust_reviewed'
  | 'account_brief_saved'

export type ActivationV2Step = {
  id: ActivationV2StepId
  title: string
  description: string
  completed: boolean
  meta?: Record<string, unknown>
}

export type ActivationV2State = {
  completedCount: number
  totalCount: number
  completed: boolean
  steps: ActivationV2Step[]
  nextBestStep: ActivationV2StepId | null
  counts: {
    targets: number
    pitches: number
    reports: number
    briefs: number
  }
  viewed: {
    pricing: boolean
    trust: boolean
    scoring: boolean
    templates: boolean
  }
}

export function buildActivationV2State(args: {
  targetsCount: number
  pitchesCount: number
  reportsCount: number
  briefsCount: number
  scoringViewed: boolean
  templatesViewed: boolean
  pricingViewed: boolean
  trustViewed: boolean
}): ActivationV2State {
  const steps: ActivationV2Step[] = [
    {
      id: 'target_accounts_added',
      title: 'Add a target account',
      description: 'Start by tracking a domain or company you want to monitor.',
      completed: args.targetsCount >= 1,
      meta: { targetsCount: args.targetsCount },
    },
    {
      id: 'first_pitch_preview_generated',
      title: 'Generate your first pitch preview',
      description: 'Turn one account into a send-ready first touch.',
      completed: args.pitchesCount >= 1,
      meta: { pitchesCount: args.pitchesCount },
    },
    {
      id: 'first_report_preview_generated',
      title: 'Generate your first report preview',
      description: 'Create a citation-backed competitive report and save it to Reports.',
      completed: args.reportsCount >= 1,
      meta: { reportsCount: args.reportsCount },
    },
    {
      id: 'first_scoring_explainer_viewed',
      title: 'Review scoring method',
      description: 'Understand what drives the 0–100 score so you can trust the daily shortlist.',
      completed: args.scoringViewed,
    },
    {
      id: 'templates_viewed',
      title: 'Open templates',
      description: 'Use copy/paste templates to stay consistent across reps and accounts.',
      completed: args.templatesViewed,
    },
    {
      id: 'account_brief_saved',
      title: 'Save your first brief',
      description: 'Generate an account brief so you can reuse context without starting over.',
      completed: args.briefsCount >= 1,
      meta: { briefsCount: args.briefsCount },
    },
    {
      id: 'pricing_reviewed',
      title: 'Review plans',
      description: 'See what unlocks when you move from preview to daily execution.',
      completed: args.pricingViewed,
    },
    {
      id: 'trust_reviewed',
      title: 'Review trust center',
      description: 'Inspect security and policy docs before you buy.',
      completed: args.trustViewed,
    },
  ]

  const completedCount = steps.filter((s) => s.completed).length
  const totalCount = steps.length
  const completed = completedCount === totalCount
  const nextBestStep = (steps.find((s) => !s.completed)?.id ?? null) as ActivationV2StepId | null

  return {
    completedCount,
    totalCount,
    completed,
    steps,
    nextBestStep,
    counts: {
      targets: args.targetsCount,
      pitches: args.pitchesCount,
      reports: args.reportsCount,
      briefs: args.briefsCount,
    },
    viewed: {
      pricing: args.pricingViewed,
      trust: args.trustViewed,
      scoring: args.scoringViewed,
      templates: args.templatesViewed,
    },
  }
}

