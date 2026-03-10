import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkflowToOutcomeLink, WorkflowEvent, DownstreamCrmEvent, VerificationLabel } from '@/lib/crm-intelligence/types'
import { verificationNote } from '@/lib/crm-intelligence/explanations'
import { deriveTimingSummary } from '@/lib/crm-intelligence/evidence'
import { getOpportunityContext } from '@/lib/services/opportunity-context'

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function summarizeTiming(args: { workflowEvents: WorkflowEvent[]; downstream: DownstreamCrmEvent[] }): { summary: string; ambiguity: string | null } {
  return deriveTimingSummary({ firstWorkflowAt: args.workflowEvents[0]?.at ?? null, firstDownstreamAt: args.downstream[0]?.at ?? null })
}

function labelFromEvidence(args: { hasVerifiedMapping: boolean; hasDownstream: boolean; hasWorkflow: boolean }): VerificationLabel {
  if (args.hasVerifiedMapping && args.hasDownstream && args.hasWorkflow) return 'probable'
  if (args.hasDownstream && args.hasWorkflow) return 'possible'
  if (args.hasWorkflow && !args.hasDownstream) return 'insufficient_evidence'
  return 'insufficient_evidence'
}

export async function buildWorkflowOutcomeLinkage(args: {
  supabase: SupabaseClient
  workspaceId: string
  accountId: string
  windowDays: number
}): Promise<WorkflowToOutcomeLink> {
  const computedAt = new Date().toISOString()
  const since = isoDaysAgo(Math.max(7, Math.min(90, args.windowDays)))

  const [queueRes, deliveriesRes, outcomesRes] = await Promise.all([
    args.supabase
      .schema('api')
      .from('action_queue_items')
      .select('id, action_type, status, created_at')
      .eq('workspace_id', args.workspaceId)
      .eq('lead_id', args.accountId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(50),
    args.supabase
      .schema('api')
      .from('action_deliveries')
      .select('id, status, created_at, meta')
      .eq('workspace_id', args.workspaceId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(100),
    args.supabase
      .schema('api')
      .from('outcome_records')
      .select('outcome, recorded_at, note')
      .eq('workspace_id', args.workspaceId)
      .eq('account_id', args.accountId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })
      .limit(25),
  ])

  const workflowEvents: WorkflowEvent[] = []
  for (const r of (queueRes.data ?? []) as Array<{ id: string; action_type?: unknown; status?: unknown; created_at?: unknown }>) {
    const at = typeof r.created_at === 'string' ? r.created_at : null
    const actionType = typeof r.action_type === 'string' ? r.action_type : 'action'
    const status = typeof r.status === 'string' ? r.status : 'ready'
    if (!at) continue
    workflowEvents.push({
      kind: status === 'delivered' ? 'handoff_delivered' : status === 'ready' ? 'handoff_prepared' : 'handoff_prepared',
      at,
      summary: `${actionType} (${status})`,
      meta: { queueItemId: r.id },
    })
  }
  for (const r of (deliveriesRes.data ?? []) as Array<{ id: string; status?: unknown; created_at?: unknown; meta?: unknown }>) {
    const at = typeof r.created_at === 'string' ? r.created_at : null
    const status = typeof r.status === 'string' ? r.status : 'queued'
    if (!at) continue
    // Only include deliveries that reference this account in meta.leadId when present.
    const meta = r.meta && typeof r.meta === 'object' ? (r.meta as Record<string, unknown>) : {}
    const leadId = typeof meta.leadId === 'string' ? meta.leadId : null
    if (leadId && leadId !== args.accountId) continue
    workflowEvents.push({
      kind: status === 'delivered' ? 'handoff_delivered' : 'handoff_prepared',
      at,
      summary: `delivery ${status}`,
      meta: { actionDeliveryId: r.id },
    })
  }
  for (const r of (outcomesRes.data ?? []) as Array<{ outcome?: unknown; recorded_at?: unknown; note?: unknown }>) {
    const at = typeof r.recorded_at === 'string' ? r.recorded_at : null
    const outcome = typeof r.outcome === 'string' ? r.outcome : null
    if (!at || !outcome) continue
    workflowEvents.push({
      kind: 'outcome_recorded',
      at,
      summary: `outcome: ${outcome}`,
      meta: typeof r.note === 'string' ? { note: r.note.slice(0, 120) } : undefined,
    })
  }

  workflowEvents.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  const crmContext = await getOpportunityContext({ supabase: args.supabase, workspaceId: args.workspaceId, accountId: args.accountId })
  const downstreamEvents: DownstreamCrmEvent[] = []
  if (crmContext.latestObservation) {
    downstreamEvents.push({
      kind: 'crm_opportunity_observed',
      at: crmContext.latestObservation.observedAt,
      summary: `CRM opportunity observed${crmContext.latestObservation.stage ? `: ${crmContext.latestObservation.stage}` : ''}`,
      crm: {
        system: crmContext.latestObservation.crmSystem,
        opportunityId: crmContext.latestObservation.opportunityId,
        stage: crmContext.latestObservation.stage,
        status: crmContext.latestObservation.status,
      },
      evidenceNote: crmContext.latestObservation.evidenceNote ?? null,
    })
  }

  downstreamEvents.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  const hasVerifiedMapping = (crmContext.accountMapping?.verificationStatus ?? 'unverified') === 'verified'
  const hasDownstream = downstreamEvents.length > 0
  const hasWorkflow = workflowEvents.length > 0

  const label = labelFromEvidence({ hasVerifiedMapping, hasDownstream, hasWorkflow })
  const { summary: timingSummary, ambiguity } = summarizeTiming({ workflowEvents, downstream: downstreamEvents })

  const limitationsNote =
    'Workflow-to-outcome linkage is a timing-based support view. It does not claim causality, and it depends on explicit mappings and observed CRM notes entered into LeadIntel.'

  return {
    type: 'workflow_to_outcome_link',
    version: 'linkage_v1',
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    verification: { label, note: verificationNote(label) },
    windowDays: Math.max(7, Math.min(90, args.windowDays)),
    workflowEvents,
    downstreamEvents,
    timingSummary,
    ambiguityNote: ambiguity,
    limitationsNote,
    computedAt,
  }
}

