import type { GrowthEventName } from '@/lib/growth-events/types'

export type GrowthEventDefinition = {
  name: GrowthEventName
  // Whether we try to dedupe the event (unique per user/workspace) when a dedupeKey is provided.
  dedupeRecommended: boolean
}

export const GROWTH_EVENT_DEFS: Record<GrowthEventName, GrowthEventDefinition> = {
  page_view: { name: 'page_view', dedupeRecommended: false },
  landing_viewed: { name: 'landing_viewed', dedupeRecommended: true },
  demo_started: { name: 'demo_started', dedupeRecommended: false },
  results_viewed: { name: 'results_viewed', dedupeRecommended: false },
  lead_search_completed: { name: 'lead_search_completed', dedupeRecommended: false },
  visitor_entry: { name: 'visitor_entry', dedupeRecommended: true },
  sample_flow_started: { name: 'sample_flow_started', dedupeRecommended: true },
  sample_flow_completed: { name: 'sample_flow_completed', dedupeRecommended: true },
  signup_started: { name: 'signup_started', dedupeRecommended: true },
  signup_completed: { name: 'signup_completed', dedupeRecommended: true },
  checkout_started: { name: 'checkout_started', dedupeRecommended: false },
  payment_completed: { name: 'payment_completed', dedupeRecommended: true },
  subscription_created: { name: 'subscription_created', dedupeRecommended: true },
  onboarding_started: { name: 'onboarding_started', dedupeRecommended: true },
  onboarding_variant_seen: { name: 'onboarding_variant_seen', dedupeRecommended: false },
  onboarding_goal_selected: { name: 'onboarding_goal_selected', dedupeRecommended: false },
  target_accounts_added: { name: 'target_accounts_added', dedupeRecommended: false },
  onboarding_workflow_selected: { name: 'onboarding_workflow_selected', dedupeRecommended: false },
  first_pitch_preview_generated: { name: 'first_pitch_preview_generated', dedupeRecommended: true },
  first_report_preview_generated: { name: 'first_report_preview_generated', dedupeRecommended: true },
  dashboard_activation_checklist_viewed: { name: 'dashboard_activation_checklist_viewed', dedupeRecommended: true },
  checklist_step_clicked: { name: 'checklist_step_clicked', dedupeRecommended: false },
  sample_flow_variant_seen: { name: 'sample_flow_variant_seen', dedupeRecommended: false },
  pricing_variant_seen: { name: 'pricing_variant_seen', dedupeRecommended: false },
  pricing_cta_clicked: { name: 'pricing_cta_clicked', dedupeRecommended: false },
  upgrade_clicked: { name: 'upgrade_clicked', dedupeRecommended: false },
  retention_signal_viewed: { name: 'retention_signal_viewed', dedupeRecommended: false },
  activation_state_changed: { name: 'activation_state_changed', dedupeRecommended: false },
  lifecycle_state_changed: { name: 'lifecycle_state_changed', dedupeRecommended: false },
  assistant_opened: { name: 'assistant_opened', dedupeRecommended: false },
  assistant_prompt_submitted: { name: 'assistant_prompt_submitted', dedupeRecommended: false },
  assistant_blocked: { name: 'assistant_blocked', dedupeRecommended: false },
  email_lab_previewed: { name: 'email_lab_previewed', dedupeRecommended: false },
  email_lab_test_send_clicked: { name: 'email_lab_test_send_clicked', dedupeRecommended: false },
  email_lab_test_send_result: { name: 'email_lab_test_send_result', dedupeRecommended: false },
  prospect_contact_created: { name: 'prospect_contact_created', dedupeRecommended: false },
  prospect_contact_selected: { name: 'prospect_contact_selected', dedupeRecommended: false },
  prospect_contact_updated: { name: 'prospect_contact_updated', dedupeRecommended: false },
  outreach_draft_saved: { name: 'outreach_draft_saved', dedupeRecommended: false },
  outreach_draft_send_ready_set: { name: 'outreach_draft_send_ready_set', dedupeRecommended: false },
  experiment_exposed: { name: 'experiment_exposed', dedupeRecommended: true },
  experiment_started: { name: 'experiment_started', dedupeRecommended: false },
  experiment_paused: { name: 'experiment_paused', dedupeRecommended: false },
  experiment_completed: { name: 'experiment_completed', dedupeRecommended: false },
  experiment_rolled_out: { name: 'experiment_rolled_out', dedupeRecommended: false },
  experiment_reverted: { name: 'experiment_reverted', dedupeRecommended: false },
  experiment_settings_viewed: { name: 'experiment_settings_viewed', dedupeRecommended: false },
  growth_dashboard_viewed: { name: 'growth_dashboard_viewed', dedupeRecommended: false },
}

export function isGrowthEventName(name: string): name is GrowthEventName {
  return Object.prototype.hasOwnProperty.call(GROWTH_EVENT_DEFS, name)
}

