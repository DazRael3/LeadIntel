import type { SupabaseClient } from '@supabase/supabase-js'
import type { AttributionSupportSummary, VerificationLabel } from '@/lib/crm-intelligence/types'
import { verificationNote } from '@/lib/crm-intelligence/explanations'
import { getOpportunityContext } from '@/lib/services/opportunity-context'
import { buildWorkflowOutcomeLinkage } from '@/lib/services/workflow-outcome-linkage'

function labelFrom(args: {
  crm: ReturnType<typeof getOpportunityContext> extends Promise<infer T> ? T : never
  linkage: ReturnType<typeof buildWorkflowOutcomeLinkage> extends Promise<infer T> ? T : never
  attributionEnabled: boolean
  ambiguousVisible: boolean
}): { label: AttributionSupportSummary['label']; verification: VerificationLabel; whatIsVerified: string[]; whatIsInferred: string[]; whatIsMissing: string[] } {
  const whatIsVerified: string[] = []
  const whatIsInferred: string[] = []
  const whatIsMissing: string[] = []

  const mapping = args.crm.accountMapping
  if (!mapping) whatIsMissing.push('No CRM mapping configured for this account.')
  else {
    if (mapping.verificationStatus === 'verified') whatIsVerified.push('CRM mapping was verified in this workspace.')
    else if (mapping.verificationStatus === 'ambiguous') whatIsMissing.push('CRM mapping is marked ambiguous.')
    else if (mapping.verificationStatus === 'needs_review') whatIsMissing.push('CRM mapping needs review.')
    else whatIsInferred.push('CRM mapping exists but is not verified.')
  }

  if (args.crm.latestObservation) whatIsVerified.push('A downstream CRM opportunity observation was recorded.')
  else whatIsMissing.push('No downstream CRM opportunity observation recorded yet.')

  if (args.linkage.workflowEvents.length > 0) whatIsVerified.push('Workflow activity was recorded in LeadIntel in the selected window.')
  else whatIsMissing.push('No workflow activity recorded in LeadIntel in the selected window.')

  // Bounded labels; never claim causality.
  if (!args.attributionEnabled) {
    return { label: 'insufficient_crm_data', verification: 'insufficient_evidence', whatIsVerified, whatIsInferred, whatIsMissing }
  }

  if (!mapping) return { label: 'insufficient_crm_data', verification: 'insufficient_evidence', whatIsVerified, whatIsInferred, whatIsMissing }

  if (mapping.verificationStatus === 'ambiguous' && !args.ambiguousVisible) {
    return { label: 'ambiguous_support', verification: 'ambiguous', whatIsVerified, whatIsInferred, whatIsMissing }
  }

  if (mapping.verificationStatus === 'verified' && args.crm.latestObservation && args.linkage.workflowEvents.length > 0) {
    return { label: 'verified_downstream_support', verification: args.linkage.verification.label, whatIsVerified, whatIsInferred, whatIsMissing }
  }

  if (args.crm.latestObservation && args.linkage.workflowEvents.length > 0) {
    return { label: 'plausible_support', verification: args.linkage.verification.label, whatIsVerified, whatIsInferred, whatIsMissing }
  }

  if (!args.crm.latestObservation) {
    return { label: 'no_verified_support_yet', verification: 'insufficient_evidence', whatIsVerified, whatIsInferred, whatIsMissing }
  }

  return { label: 'ambiguous_support', verification: 'ambiguous', whatIsVerified, whatIsInferred, whatIsMissing }
}

export async function buildAttributionSupportSummary(args: {
  supabase: SupabaseClient
  workspaceId: string
  accountId: string
  windowDays: number
  attributionEnabled: boolean
  ambiguousVisible: boolean
}): Promise<AttributionSupportSummary> {
  const computedAt = new Date().toISOString()
  const [crm, linkage] = await Promise.all([
    getOpportunityContext({ supabase: args.supabase, workspaceId: args.workspaceId, accountId: args.accountId }),
    buildWorkflowOutcomeLinkage({ supabase: args.supabase, workspaceId: args.workspaceId, accountId: args.accountId, windowDays: args.windowDays }),
  ])

  const derived = labelFrom({ crm, linkage, attributionEnabled: args.attributionEnabled, ambiguousVisible: args.ambiguousVisible })
  const limitationsNote =
    'Attribution support is bounded: it summarizes verified downstream observations and their timing relative to workflow activity. It does not claim LeadIntel caused pipeline or revenue.'

  return {
    type: 'attribution_support_summary',
    version: 'attrib_support_v1',
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    label: derived.label,
    verification: { label: derived.verification, note: verificationNote(derived.verification) },
    whatIsVerified: derived.whatIsVerified,
    whatIsInferred: derived.whatIsInferred,
    whatIsMissing: derived.whatIsMissing,
    limitationsNote,
    computedAt,
  }
}

