import type { VerticalUseCaseDefinition, VerticalUseCaseKey } from './types'

export const VERTICAL_USE_CASES: Record<VerticalUseCaseKey, VerticalUseCaseDefinition> = {
  timing_first_prospecting: {
    key: 'timing_first_prospecting',
    label: 'Timing-first prospecting',
    description: 'Prioritize who to contact today based on fresh signals and visible score reasons.',
    recommendedSteps: [
      'Build a watchlist of target accounts.',
      'Review the daily shortlist and score reasons.',
      'Draft a first-touch message grounded in signals and ICP fit.',
      'Push/export the action when timing is fresh.',
    ],
    relatedRoutes: ['/dashboard', '/templates', '/use-cases'],
  },
  account_based_outbound: {
    key: 'account_based_outbound',
    label: 'Account-based outbound',
    description: 'Run outbound around a target list and “why now” signals (not generic lead sourcing).',
    recommendedSteps: [
      'Define ICP so scoring is deterministic and explainable.',
      'Track a focused list of target accounts.',
      'Use account explainability (signals, momentum, intent) to decide timing.',
      'Generate send-ready drafts and take action via webhook/export when needed.',
    ],
    relatedRoutes: ['/dashboard', '/templates', '/pricing'],
  },
  enablement_template_standardization: {
    key: 'enablement_template_standardization',
    label: 'Enablement + template standardization',
    description: 'Keep messaging consistent across reps while preserving truthfulness and “why now” clarity.',
    recommendedSteps: [
      'Use tokenized templates as a baseline (curly tokens only).',
      'Approve shared templates (Team) to prevent drift.',
      'Use persona recommendations + why-now context to pick the right opener.',
    ],
    relatedRoutes: ['/templates', '/settings/templates', '/pricing'],
  },
  operator_workflow_handoff: {
    key: 'operator_workflow_handoff',
    label: 'Operator workflow handoff',
    description: 'Package outputs for downstream systems without turning LeadIntel into a CRM.',
    recommendedSteps: [
      'Generate explainable account context (score reasons, signals, momentum).',
      'Export operator-safe summaries when premium content is locked.',
      'Use webhooks for workflow automation (Team).',
    ],
    relatedRoutes: ['/pricing', '/settings/integrations', '/settings/exports'],
  },
} as const

