export type LearningModuleId = 'basics.track_accounts' | 'basics.why_now' | 'basics.prepare_handoff' | 'team.approvals' | 'team.verification'

export type LearningModule = {
  id: LearningModuleId
  title: string
  description: string
  minutes: number
  surfaceLinks: Array<{ label: string; href: string }>
  evidenceNote: string
}

export type LearningPathId = 'rep_basics' | 'manager_basics'

export type LearningPath = {
  id: LearningPathId
  title: string
  description: string
  modules: LearningModuleId[]
  disclaimer: string
}

