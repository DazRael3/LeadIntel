export type RefinementGapCategoryKey =
  | 'copy_inconsistency'
  | 'cta_inconsistency'
  | 'empty_states'
  | 'loading_states'
  | 'error_states'
  | 'mobile_responsiveness'
  | 'permission_gating_confusion'
  | 'stale_terminology'
  | 'trust_overstatement_risk'
  | 'route_continuity'
  | 'edge_case_handling'
  | 'table_filter_consistency'
  | 'action_confirmation_consistency'
  | 'assistant_help_mismatch'
  | 'visual_hierarchy'
  | 'vertical_use_case_copy_gaps'

export type RefinementGapCategory = {
  key: RefinementGapCategoryKey
  label: string
  intent: string
}

export const REFINEMENT_GAP_CATEGORIES: RefinementGapCategory[] = [
  { key: 'copy_inconsistency', label: 'Copy inconsistency', intent: 'Remove contradictory phrases and unify terminology across surfaces.' },
  { key: 'cta_inconsistency', label: 'CTA inconsistency', intent: 'Make primary/secondary actions predictable and consistent.' },
  { key: 'empty_states', label: 'Empty states', intent: 'No dead-ends; every empty state explains what to do next.' },
  { key: 'loading_states', label: 'Loading states', intent: 'Deliberate loading treatments; no jitter or blank screens.' },
  { key: 'error_states', label: 'Error states', intent: 'Calm failures with actionable next steps and safe details.' },
  { key: 'mobile_responsiveness', label: 'Mobile responsiveness gaps', intent: 'Fix narrow-screen density, tap targets, truncation, and overflow.' },
  { key: 'permission_gating_confusion', label: 'Permission / gating confusion', intent: 'Users understand plan/role gating without feeling “broken”.' },
  { key: 'stale_terminology', label: 'Stale terminology', intent: 'Eliminate legacy labels that don’t map to real objects.' },
  { key: 'trust_overstatement_risk', label: 'Trust/copy overstatement risk', intent: 'Prevent accidental over-claims in marketing and product surfaces.' },
  { key: 'route_continuity', label: 'Route-to-route continuity', intent: 'After actions, users know what happened and where to go next.' },
  { key: 'edge_case_handling', label: 'Edge-case handling', intent: 'Thin/stale/locked/partial states are explicit and safe.' },
  { key: 'table_filter_consistency', label: 'Table/filter inconsistency', intent: 'Filtering and sorting behaves consistently across tables.' },
  { key: 'action_confirmation_consistency', label: 'Action confirmation inconsistency', intent: 'Success/error confirmations feel consistent across actions.' },
  { key: 'assistant_help_mismatch', label: 'Assistant/help mismatch', intent: 'Help surfaces align with actual workflows and objects.' },
  { key: 'visual_hierarchy', label: 'Visual hierarchy problems', intent: 'Reduce noise; emphasize what matters/what changed/what next.' },
  { key: 'vertical_use_case_copy_gaps', label: 'Vertical/use-case copy gaps', intent: 'Bounded, truthful segmentation without fake specialization.' },
] as const

