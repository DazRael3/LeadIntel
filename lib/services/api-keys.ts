import type { SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/env'
import type { PlatformScope } from '@/lib/platform-api/types'
import { apiKeyPrefix, hashPlatformKey } from '@/lib/platform-api/auth'
import { randomApiKeySecret } from '@/lib/platform-api/security'

export type ApiKeyCreateResult =
  | { ok: true; apiKeyId: string; prefix: string; rawKey: string }
  | { ok: false; reason: 'unavailable' | 'database_error'; message: string }

export async function createWorkspaceApiKey(args: {
  supabase: SupabaseClient
  workspaceId: string
  actorUserId: string
  name: string
  scopes: PlatformScope[]
}): Promise<ApiKeyCreateResult> {
  const pepper = (serverEnv.PLATFORM_API_KEY_PEPPER ?? '').trim()
  if (!pepper) return { ok: false, reason: 'unavailable', message: 'Platform API key pepper not configured.' }

  const rawKey = `li_sk_${randomApiKeySecret(24)}`
  const prefix = apiKeyPrefix(rawKey)
  const keyHash = hashPlatformKey({ rawKey, pepper })

  const { data, error } = await args.supabase
    .schema('api')
    .from('api_keys')
    .insert({
      workspace_id: args.workspaceId,
      name: args.name,
      prefix,
      key_hash: keyHash,
      scopes: args.scopes,
      created_by: args.actorUserId,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, reason: 'database_error', message: 'Failed to create API key.' }
  const id = (data as { id?: unknown } | null)?.id
  if (typeof id !== 'string') return { ok: false, reason: 'database_error', message: 'Failed to create API key.' }

  return { ok: true, apiKeyId: id, prefix, rawKey }
}

export async function listWorkspaceApiKeys(args: { supabase: SupabaseClient; workspaceId: string }): Promise<
  Array<{
    id: string
    name: string
    prefix: string
    scopes: PlatformScope[]
    created_by: string
    created_at: string
    revoked_at: string | null
    revoked_by: string | null
    last_used_at: string | null
  }>
> {
  const { data } = await args.supabase
    .schema('api')
    .from('api_keys')
    .select('id, name, prefix, scopes, created_by, created_at, revoked_at, revoked_by, last_used_at')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false })
    .limit(200)

  return (data ?? []) as unknown as Array<{
    id: string
    name: string
    prefix: string
    scopes: PlatformScope[]
    created_by: string
    created_at: string
    revoked_at: string | null
    revoked_by: string | null
    last_used_at: string | null
  }>
}

export async function revokeWorkspaceApiKey(args: {
  supabase: SupabaseClient
  workspaceId: string
  actorUserId: string
  apiKeyId: string
}): Promise<{ ok: true } | { ok: false }> {
  const { error } = await args.supabase
    .schema('api')
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString(), revoked_by: args.actorUserId })
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.apiKeyId)
    .is('revoked_at', null)
  if (error) return { ok: false }
  return { ok: true }
}

