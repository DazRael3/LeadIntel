import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type {
  CrmMappingKind,
  CrmObjectMapping,
  CrmSystem,
  CrmMappingStatus,
  CrmMappingVerificationStatus,
} from '@/lib/crm-intelligence/types'

type DbRow = {
  id: string
  workspace_id: string
  account_id: string | null
  mapping_kind: string
  crm_system: string
  crm_object_id: string
  status: string
  verification_status: string
  reason: string | null
  meta: unknown
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string
}

function isSystem(x: string): x is CrmSystem {
  return x === 'generic'
}
function isKind(x: string): x is CrmMappingKind {
  return x === 'account' || x === 'opportunity'
}
function isStatus(x: string): x is CrmMappingStatus {
  return x === 'mapped' || x === 'ambiguous' || x === 'stale' || x === 'unmapped'
}
function isVerification(x: string): x is CrmMappingVerificationStatus {
  return x === 'unverified' || x === 'verified' || x === 'ambiguous' || x === 'not_linked' || x === 'needs_review'
}

function normalize(row: DbRow): CrmObjectMapping {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    accountId: row.account_id,
    mappingKind: isKind(row.mapping_kind) ? row.mapping_kind : 'account',
    crmSystem: isSystem(row.crm_system) ? row.crm_system : 'generic',
    crmObjectId: row.crm_object_id,
    status: isStatus(row.status) ? row.status : 'mapped',
    verificationStatus: isVerification(row.verification_status) ? row.verification_status : 'unverified',
    reason: row.reason ?? null,
    meta: row.meta && typeof row.meta === 'object' ? (row.meta as Record<string, unknown>) : {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at,
  }
}

export const UpsertCrmMappingSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  mappingKind: z.enum(['account', 'opportunity']),
  crmSystem: z.enum(['generic']).default('generic'),
  crmObjectId: z.string().trim().min(1).max(128),
  status: z.enum(['mapped', 'ambiguous', 'stale', 'unmapped']).default('mapped'),
  verificationStatus: z.enum(['unverified', 'verified', 'ambiguous', 'not_linked', 'needs_review']).default('unverified'),
  reason: z.string().trim().min(1).max(400).nullable().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})

export async function listCrmMappings(args: { supabase: SupabaseClient; workspaceId: string; accountId?: string }): Promise<CrmObjectMapping[]> {
  let q = args.supabase
    .schema('api')
    .from('crm_object_mappings')
    .select(
      'id, workspace_id, account_id, mapping_kind, crm_system, crm_object_id, status, verification_status, reason, meta, created_by, created_at, updated_by, updated_at'
    )
    .eq('workspace_id', args.workspaceId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (args.accountId) q = q.eq('account_id', args.accountId)

  const { data, error } = await q
  if (error) throw new Error('crm_mappings_list_failed')
  return (data ?? []).map((r) => normalize(r as unknown as DbRow))
}

export async function upsertCrmMapping(args: {
  supabase: SupabaseClient
  workspaceId: string
  actorUserId: string
  input: z.infer<typeof UpsertCrmMappingSchema>
}): Promise<CrmObjectMapping> {
  const parsed = UpsertCrmMappingSchema.parse(args.input)
  const nowIso = new Date().toISOString()

  // For account mappings, use unique constraint (workspace, account, system, kind).
  // For opportunity mappings, use unique (workspace, system, object_id, kind).
  const onConflict =
    parsed.mappingKind === 'account'
      ? 'workspace_id,account_id,crm_system,mapping_kind'
      : 'workspace_id,crm_system,crm_object_id,mapping_kind'

  const { data, error } = await args.supabase
    .schema('api')
    .from('crm_object_mappings')
    .upsert(
      {
        workspace_id: args.workspaceId,
        account_id: parsed.accountId ?? null,
        mapping_kind: parsed.mappingKind,
        crm_system: parsed.crmSystem,
        crm_object_id: parsed.crmObjectId,
        status: parsed.status,
        verification_status: parsed.verificationStatus,
        reason: parsed.reason ?? null,
        meta: parsed.meta ?? {},
        created_by: args.actorUserId,
        updated_by: args.actorUserId,
        updated_at: nowIso,
      },
      { onConflict }
    )
    .select(
      'id, workspace_id, account_id, mapping_kind, crm_system, crm_object_id, status, verification_status, reason, meta, created_by, created_at, updated_by, updated_at'
    )
    .single()

  if (error || !data) throw new Error('crm_mappings_upsert_failed')
  return normalize(data as unknown as DbRow)
}

