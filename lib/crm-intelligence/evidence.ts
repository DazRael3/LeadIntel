import type { AttributionSupportSummary, CrmMappingVerificationStatus, VerificationLabel } from '@/lib/crm-intelligence/types'

export function deriveTimingSummary(args: { firstWorkflowAt: string | null; firstDownstreamAt: string | null }): { summary: string; ambiguity: string | null } {
  if (!args.firstWorkflowAt || !args.firstDownstreamAt) return { summary: 'Insufficient timeline events to compare timing.', ambiguity: null }
  const wf = Date.parse(args.firstWorkflowAt)
  const ds = Date.parse(args.firstDownstreamAt)
  if (!Number.isFinite(wf) || !Number.isFinite(ds)) return { summary: 'Timing comparison unavailable.', ambiguity: null }
  const deltaHours = (ds - wf) / (1000 * 60 * 60)
  if (deltaHours < 0) {
    return {
      summary: 'A downstream CRM observation predates recorded workflow actions in this window.',
      ambiguity: 'Downstream activity may be unrelated to this workflow window, or the workflow timeline is incomplete.',
    }
  }
  if (deltaHours < 24) return { summary: 'Downstream CRM activity was observed within ~24 hours of workflow activity.', ambiguity: 'Multi-touch ambiguity may still apply.' }
  if (deltaHours < 7 * 24) return { summary: 'Downstream CRM activity was observed within ~7 days of workflow activity.', ambiguity: 'Multi-touch ambiguity may still apply.' }
  return { summary: 'Downstream CRM activity was observed after workflow activity, but outside tight windows.', ambiguity: 'The relationship may be coincidental or multi-touch; treat as supporting evidence only.' }
}

export function deriveAttributionSupport(args: {
  mappingStatus: CrmMappingVerificationStatus | null
  hasDownstreamObservation: boolean
  hasWorkflowActivity: boolean
  attributionEnabled: boolean
  ambiguousVisible: boolean
}): { label: AttributionSupportSummary['label']; verification: VerificationLabel } {
  if (!args.attributionEnabled) return { label: 'insufficient_crm_data', verification: 'insufficient_evidence' }
  if (!args.mappingStatus) return { label: 'insufficient_crm_data', verification: 'insufficient_evidence' }

  if (args.mappingStatus === 'ambiguous' && !args.ambiguousVisible) return { label: 'ambiguous_support', verification: 'ambiguous' }
  if (args.mappingStatus === 'verified' && args.hasDownstreamObservation && args.hasWorkflowActivity) return { label: 'verified_downstream_support', verification: 'probable' }
  if (args.hasDownstreamObservation && args.hasWorkflowActivity) return { label: 'plausible_support', verification: 'possible' }
  if (!args.hasDownstreamObservation) return { label: 'no_verified_support_yet', verification: 'insufficient_evidence' }
  return { label: 'ambiguous_support', verification: 'ambiguous' }
}

