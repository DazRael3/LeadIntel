import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdoptionHealthSummary, AdoptionSignal, HealthLabel } from '@/lib/customer-success/types'

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function healthFromSignals(args: { tracked: number; delivered: number; outcomes: number; integrationsConfigured: number }): { label: HealthLabel; reason: string } {
  // Bounded operational labels. No churn/renewal prediction.
  if (args.tracked >= 5 && args.delivered >= 1 && args.outcomes >= 1) return { label: 'strong', reason: 'Consistent workflow usage with downstream tracking.' }
  if (args.tracked >= 2 && (args.delivered >= 1 || args.outcomes >= 1)) return { label: 'usable', reason: 'Some workflow usage is present; expand consistency for stronger health.' }
  return { label: 'limited', reason: 'Observed workflow usage is limited in this window.' }
}

export async function buildAdoptionHealthSummary(args: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
  windowDays: number
}): Promise<AdoptionHealthSummary> {
  const computedAt = new Date().toISOString()
  const windowDays = Math.max(7, Math.min(90, Math.floor(args.windowDays)))
  const since = isoDaysAgo(windowDays)

  const [leadsRes, queueRes, deliveriesRes, outcomesRes, approvalsRes, endpointsRes] = await Promise.all([
    args.supabase.schema('api').from('leads').select('id', { count: 'exact', head: true }).eq('user_id', args.userId),
    args.supabase.schema('api').from('action_queue_items').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).gte('created_at', since),
    args.supabase
      .schema('api')
      .from('action_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', args.workspaceId)
      .eq('status', 'delivered')
      .gte('created_at', since),
    args.supabase.schema('api').from('outcome_records').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).gte('recorded_at', since),
    args.supabase
      .schema('api')
      .from('approval_requests')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', args.workspaceId)
      .gte('updated_at', since),
    args.supabase.schema('api').from('webhook_endpoints').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).eq('is_enabled', true),
  ])

  const toCount = (x: { count: number | null } | null | undefined) => (typeof x?.count === 'number' ? x.count : 0)

  const tracked = toCount(leadsRes)
  const prepared = toCount(queueRes)
  const delivered = toCount(deliveriesRes)
  const outcomes = toCount(outcomesRes)
  const approvals = toCount(approvalsRes)
  const integrationsConfigured = toCount(endpointsRes)

  const health = healthFromSignals({ tracked, delivered, outcomes, integrationsConfigured })

  const signals: AdoptionSignal[] = [
    { key: 'accounts_tracked', label: 'Accounts tracked', value: tracked, windowDays, observedAt: computedAt, note: 'Observed account tracking in this workspace.' },
    { key: 'actions_prepared', label: 'Actions prepared', value: prepared, windowDays, observedAt: computedAt, note: 'Prepared queue items (may include blocked/failed).' },
    { key: 'actions_delivered', label: 'Actions delivered', value: delivered, windowDays, observedAt: computedAt, note: 'Delivered actions recorded in delivery history.' },
    { key: 'outcomes_recorded', label: 'Outcomes recorded', value: outcomes, windowDays, observedAt: computedAt, note: 'Manual outcomes entered by users (observed, non-causal).' },
    { key: 'approvals_used', label: 'Approvals activity', value: approvals, windowDays, observedAt: computedAt, note: 'Approval workflow updates in this window (if enabled).' },
    { key: 'integrations_configured', label: 'Integrations configured', value: integrationsConfigured, windowDays, observedAt: computedAt, note: 'Enabled webhook endpoints (exports not counted here).' },
  ]

  return {
    type: 'adoption_health_summary',
    version: 'adoption_v1',
    workspaceId: args.workspaceId,
    windowDays,
    health: health.label,
    reasonSummary: health.reason,
    signals,
    limitationsNote:
      'Adoption health is derived from observed usage signals in LeadIntel. Leads are user-scoped in this repo; shared workflow signals are workspace-scoped. This is not a churn/renewal predictor.',
    computedAt,
  }
}

