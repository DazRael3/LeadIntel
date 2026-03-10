import type { SupabaseClient } from '@supabase/supabase-js'
import {
  defaultWorkspacePolicies,
  mergeWorkspacePolicies,
  WorkspacePoliciesPatchSchema,
  WorkspacePoliciesSchema,
  type WorkspacePolicies,
} from '@/lib/domain/workspace-policies'

type DbPolicyRow = {
  workspace_id: string
  policy: unknown
  updated_by: string | null
  updated_at: string
}

export async function getWorkspacePolicies(args: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<{ policies: WorkspacePolicies; updatedAt: string | null }> {
  const { data } = await args.supabase
    .schema('api')
    .from('workspace_policies')
    .select('workspace_id, policy, updated_by, updated_at')
    .eq('workspace_id', args.workspaceId)
    .maybeSingle()

  if (!data) return { policies: defaultWorkspacePolicies(), updatedAt: null }
  const row = data as unknown as DbPolicyRow
  const parsed = defaultWorkspacePolicies()
  const patch = WorkspacePoliciesPatchSchema.safeParse(row.policy)
  const merged = patch.success ? mergeWorkspacePolicies({ current: parsed, patch: patch.data }) : parsed
  // Ensure full schema normalization even if patch omitted defaults.
  const normalized = WorkspacePoliciesSchema.parse(merged)
  return { policies: normalized, updatedAt: row.updated_at ?? null }
}

export async function updateWorkspacePolicies(args: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
  patch: unknown
}): Promise<{ policies: WorkspacePolicies; updatedAt: string }> {
  const parsedPatch = WorkspacePoliciesPatchSchema.safeParse(args.patch)
  if (!parsedPatch.success) {
    throw new Error('invalid_policy_patch')
  }

  const current = await getWorkspacePolicies({ supabase: args.supabase, workspaceId: args.workspaceId })
  const next = mergeWorkspacePolicies({ current: current.policies, patch: parsedPatch.data })

  const nowIso = new Date().toISOString()
  const { data, error } = await args.supabase
    .schema('api')
    .from('workspace_policies')
    .upsert(
      {
        workspace_id: args.workspaceId,
        policy: next,
        updated_by: args.userId,
        updated_at: nowIso,
      },
      { onConflict: 'workspace_id' }
    )
    .select('policy, updated_at')
    .single()

  if (error || !data) throw new Error('failed_to_update_policies')
  const updatedAt = (data as { updated_at?: unknown }).updated_at
  return { policies: next, updatedAt: typeof updatedAt === 'string' ? updatedAt : nowIso }
}

