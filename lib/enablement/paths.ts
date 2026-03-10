import type { LearningModule, LearningPath } from '@/lib/enablement/types'

export const LEARNING_MODULES: Record<LearningModule['id'], LearningModule> = {
  'basics.track_accounts': {
    id: 'basics.track_accounts',
    title: 'Track target accounts',
    description: 'Build a watchlist you can work repeatedly.',
    minutes: 5,
    surfaceLinks: [{ label: 'Dashboard', href: '/dashboard' }],
    evidenceNote: 'Completion indicates this module was viewed in-app, not that proficiency was demonstrated.',
  },
  'basics.why_now': {
    id: 'basics.why_now',
    title: 'Understand “why now”',
    description: 'Learn how signals, freshness, and coverage affect recommendations.',
    minutes: 6,
    surfaceLinks: [{ label: 'Open an account', href: '/dashboard' }],
    evidenceNote: 'Signals are explainable; when data is thin, LeadIntel will say so.',
  },
  'basics.prepare_handoff': {
    id: 'basics.prepare_handoff',
    title: 'Prepare a handoff',
    description: 'Package outreach context for CRM/sequencer workflows without claiming delivery happens automatically.',
    minutes: 7,
    surfaceLinks: [{ label: 'Integrations', href: '/settings/integrations' }],
    evidenceNote: 'Handoffs are prepared and delivered only when configured and explicitly triggered.',
  },
  'team.approvals': {
    id: 'team.approvals',
    title: 'Approvals (Team)',
    description: 'Use lightweight approvals for shared templates and workflows.',
    minutes: 6,
    surfaceLinks: [{ label: 'Approvals', href: '/settings/approvals' }],
    evidenceNote: 'Approvals are auditable and role-gated; they are not automatic “AI approvals”.',
  },
  'team.verification': {
    id: 'team.verification',
    title: 'Outcome verification (Team)',
    description: 'Verify downstream linkage without overclaiming attribution.',
    minutes: 6,
    surfaceLinks: [
      { label: 'Revenue intelligence', href: '/settings/revenue-intelligence' },
      { label: 'Verification queue', href: '/dashboard/verification' },
    ],
    evidenceNote: 'Verification is human-entered evidence; it does not claim pipeline attribution.',
  },
}

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'rep_basics',
    title: 'Rep basics',
    description: 'A fast path to go from signal → action with explainability.',
    modules: ['basics.track_accounts', 'basics.why_now', 'basics.prepare_handoff'],
    disclaimer: 'This is guided learning. It is not a certification and does not imply demonstrated proficiency.',
  },
  {
    id: 'manager_basics',
    title: 'Manager basics',
    description: 'Review workflow readiness, governance, and verification without surveillance.',
    modules: ['basics.why_now', 'team.approvals', 'team.verification'],
    disclaimer: 'This is guided learning. It is not a certification and does not imply demonstrated proficiency.',
  },
]

