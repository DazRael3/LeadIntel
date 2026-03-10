export const EXPERIMENT_SURFACES = [
  'pricing_public',
  'dashboard_getting_started',
  'dashboard_activation',
  'onboarding_flow',
  'assistant_suggested_prompts',
] as const

export type ExperimentSurface = (typeof EXPERIMENT_SURFACES)[number]

export const GROWTH_METRICS = [
  'onboarding_started',
  'target_accounts_added',
  'first_pitch_preview_generated',
  'first_report_preview_generated',
  'pricing_cta_clicked',
  'upgrade_clicked',
  'dashboard_activation_checklist_viewed',
  'checklist_step_clicked',
  'assistant_opened',
] as const

export type GrowthMetricKey = (typeof GROWTH_METRICS)[number]

export function isAllowedSurface(surface: string): boolean {
  return (EXPERIMENT_SURFACES as readonly string[]).includes(surface)
}

