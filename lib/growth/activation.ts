export type ActivationStepId = 'icp' | 'accounts_10' | 'first_pitch' | 'digest_cadence'

export type ActivationStep = {
  id: ActivationStepId
  title: string
  description: string
  completed: boolean
  meta?: Record<string, unknown>
}

export type ActivationState = {
  completedCount: number
  totalCount: number
  completed: boolean
  checklistCompletedAt: string | null
  steps: ActivationStep[]
  counts: {
    accounts: number
    pitches: number
  }
}

export function buildActivationState(args: {
  icpConfigured: boolean
  accountsCount: number
  pitchesCount: number
  digestCadenceOn: boolean
  checklistCompletedAt: string | null
}): ActivationState {
  const steps: ActivationStep[] = [
    {
      id: 'icp',
      title: 'Define ICP',
      description: 'Your ICP drives prioritization and targeted drafts.',
      completed: args.icpConfigured,
    },
    {
      id: 'accounts_10',
      title: 'Add 10 target accounts',
      description: 'Your list becomes the daily shortlist.',
      completed: args.accountsCount >= 10,
      meta: { accountsCount: args.accountsCount, target: 10 },
    },
    {
      id: 'first_pitch',
      title: 'Generate first pitch draft',
      description: 'Turn one account into a send-ready draft.',
      completed: args.pitchesCount >= 1,
      meta: { pitchesCount: args.pitchesCount },
    },
    {
      id: 'digest_cadence',
      title: 'Turn on digest cadence',
      description: 'Get your shortlist by email on a schedule.',
      completed: args.digestCadenceOn,
    },
  ]

  const completedCount = steps.filter((s) => s.completed).length
  const totalCount = steps.length
  const completed = completedCount === totalCount

  return {
    completedCount,
    totalCount,
    completed,
    checklistCompletedAt: args.checklistCompletedAt,
    steps,
    counts: { accounts: args.accountsCount, pitches: args.pitchesCount },
  }
}

