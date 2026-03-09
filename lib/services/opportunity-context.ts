import type { SupabaseClient } from '@supabase/supabase-js'
import type { OpportunityContext, CrmOpportunityObservation, CrmSystem } from '@/lib/crm-intelligence/types'
import { verificationFromMappingStatus } from '@/lib/crm-intelligence/confidence'
import { verificationNote, limitationsForNoCrm } from '@/lib/crm-intelligence/explanations'
import { splitMappings } from '@/lib/crm-intelligence/mapping'
import { listCrmMappings } from '@/lib/services/crm-object-mapping'

type ObsRow = {
  id: string
  workspace_id: string
  account_id: string | null
  opportunity_mapping_id: string | null
  crm_system: string
  opportunity_id: string
  stage: string | null
  status: string | null
  observed_at: string
  source: string
  evidence_note: string | null
  meta: unknown
  recorded_by: string
  created_at: string
}

function isSystem(x: string): x is CrmSystem {
  return x === 'generic'
}

function normalizeObs(r: ObsRow): CrmOpportunityObservation {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    accountId: r.account_id,
    opportunityMappingId: r.opportunity_mapping_id,
    crmSystem: isSystem(r.crm_system) ? r.crm_system : 'generic',
    opportunityId: r.opportunity_id,
    stage: r.stage ?? null,
    status: r.status ?? null,
    observedAt: r.observed_at,
    source: r.source === 'webhook' ? 'webhook' : 'manual',
    evidenceNote: r.evidence_note ?? null,
    meta: r.meta && typeof r.meta === 'object' ? (r.meta as Record<string, unknown>) : {},
    recordedBy: r.recorded_by,
    createdAt: r.created_at,
  }
}

export async function getOpportunityContext(args: {
  supabase: SupabaseClient
  workspaceId: string
  accountId: string
  now?: Date
}): Promise<OpportunityContext> {
  const computedAt = (args.now ?? new Date()).toISOString()

  const mappings = await listCrmMappings({ supabase: args.supabase, workspaceId: args.workspaceId, accountId: args.accountId })
  const { account, opportunities } = splitMappings({ mappings })

  const oppIds = opportunities.map((o) => o.crmObjectId)
  let latestObservation: CrmOpportunityObservation | null = null
  if (oppIds.length > 0) {
    const { data } = await args.supabase
      .schema('api')
      .from('crm_opportunity_observations')
      .select(
        'id, workspace_id, account_id, opportunity_mapping_id, crm_system, opportunity_id, stage, status, observed_at, source, evidence_note, meta, recorded_by, created_at'
      )
      .eq('workspace_id', args.workspaceId)
      .eq('account_id', args.accountId)
      .in('opportunity_id', oppIds)
      .order('observed_at', { ascending: false })
      .limit(1)

    const row = (data?.[0] ?? null) as unknown as ObsRow | null
    if (row) latestObservation = normalizeObs(row)
  }

  const label = account ? verificationFromMappingStatus(account.verificationStatus) : 'insufficient_evidence'
  const note = verificationNote(label)

  const limitationsNote = account
    ? 'CRM context is based on explicit mappings and manual observations in this workspace. This is not a live CRM sync, and does not imply revenue attribution.'
    : limitationsForNoCrm()

  return {
    type: 'opportunity_context',
    version: 'crm_intel_v1',
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    crmSystem: 'generic',
    accountMapping: account,
    opportunities,
    latestObservation,
    verification: { label, note },
    limitationsNote,
    computedAt,
  }
}

