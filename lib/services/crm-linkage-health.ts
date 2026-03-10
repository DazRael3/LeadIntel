import type { SupabaseClient } from '@supabase/supabase-js'

export type CrmLinkageHealth = {
  workspaceId: string
  mappedAccounts: number
  verifiedAccountMappings: number
  opportunityMappings: number
  observations: number
  needsReviewMappings: number
  ambiguousMappings: number
  staleMappings: number
  note: string
  computedAt: string
}

export async function getCrmLinkageHealth(args: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<CrmLinkageHealth> {
  const computedAt = new Date().toISOString()

  const [
    accountMapsRes,
    verifiedRes,
    oppRes,
    obsRes,
    needsReviewRes,
    ambiguousRes,
    staleRes,
  ] = await Promise.all([
    args.supabase.schema('api').from('crm_object_mappings').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).eq('mapping_kind', 'account'),
    args.supabase
      .schema('api')
      .from('crm_object_mappings')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', args.workspaceId)
      .eq('mapping_kind', 'account')
      .eq('verification_status', 'verified'),
    args.supabase.schema('api').from('crm_object_mappings').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).eq('mapping_kind', 'opportunity'),
    args.supabase.schema('api').from('crm_opportunity_observations').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId),
    args.supabase.schema('api').from('crm_object_mappings').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).eq('verification_status', 'needs_review'),
    args.supabase.schema('api').from('crm_object_mappings').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).eq('verification_status', 'ambiguous'),
    args.supabase.schema('api').from('crm_object_mappings').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).eq('status', 'stale'),
  ])

  const toCount = (x: { count: number | null } | null | undefined) => (typeof x?.count === 'number' ? x.count : 0)

  return {
    workspaceId: args.workspaceId,
    mappedAccounts: toCount(accountMapsRes),
    verifiedAccountMappings: toCount(verifiedRes),
    opportunityMappings: toCount(oppRes),
    observations: toCount(obsRes),
    needsReviewMappings: toCount(needsReviewRes),
    ambiguousMappings: toCount(ambiguousRes),
    staleMappings: toCount(staleRes),
    note: 'Linkage health reflects explicit mappings and observations recorded in LeadIntel. It is not a live CRM sync health indicator.',
    computedAt,
  }
}

