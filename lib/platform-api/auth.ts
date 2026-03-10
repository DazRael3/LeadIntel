import type { NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import type { PlatformAuthContext, PlatformScope } from '@/lib/platform-api/types'
import { PLATFORM_API_V1 } from '@/lib/platform-api/versioning'
import { sha256Hex, timingSafeEqualHex } from '@/lib/platform-api/security'

type ApiKeyRow = {
  id: string
  workspace_id: string
  prefix: string
  key_hash: string
  scopes: unknown
  revoked_at: string | null
}

function normalizeScopes(v: unknown): PlatformScope[] {
  const allowed = new Set<PlatformScope>([
    'workspace.read',
    'accounts.read',
    'action_queue.read',
    'delivery.read',
    'benchmarks.read',
    'embed.token.create',
  ])
  if (!Array.isArray(v)) return []
  const out: PlatformScope[] = []
  for (const s of v) {
    if (typeof s !== 'string') continue
    const t = s.trim() as PlatformScope
    if (allowed.has(t)) out.push(t)
  }
  return Array.from(new Set(out))
}

export function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization') ?? ''
  const m = auth.match(/^bearer\s+(.+)$/i)
  const token = (m?.[1] ?? '').trim()
  return token.length > 0 ? token : null
}

export function apiKeyPrefix(key: string): string {
  // Stable prefix used for lookup; does not reveal full key.
  return key.slice(0, 10)
}

export function hashPlatformKey(args: { rawKey: string; pepper: string }): string {
  return sha256Hex(`${args.pepper}.${args.rawKey}`)
}

export async function authenticatePlatformRequest(args: {
  request: NextRequest
  requestId: string
}): Promise<
  | { ok: true; ctx: PlatformAuthContext }
  | { ok: false; reason: 'missing' | 'invalid' | 'revoked' | 'unavailable' }
> {
  const rawKey = extractBearerToken(args.request)
  if (!rawKey) return { ok: false, reason: 'missing' }

  const pepper = (serverEnv.PLATFORM_API_KEY_PEPPER ?? '').trim()
  if (!pepper) return { ok: false, reason: 'unavailable' }

  const prefix = apiKeyPrefix(rawKey)
  if (prefix.length < 6) return { ok: false, reason: 'invalid' }

  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data } = await admin
    .from('api_keys')
    .select('id, workspace_id, prefix, key_hash, scopes, revoked_at')
    .eq('prefix', prefix)
    .limit(5)

  const rows = (data ?? []) as unknown as ApiKeyRow[]
  const hashed = hashPlatformKey({ rawKey, pepper })
  const match = rows.find((r) => typeof r.key_hash === 'string' && r.key_hash.length === hashed.length && timingSafeEqualHex(r.key_hash, hashed))
  if (!match) return { ok: false, reason: 'invalid' }
  if (match.revoked_at) return { ok: false, reason: 'revoked' }

  return {
    ok: true,
    ctx: {
      apiVersion: PLATFORM_API_V1,
      workspaceId: match.workspace_id,
      apiKeyId: match.id,
      scopes: normalizeScopes(match.scopes),
      requestId: args.requestId,
    },
  }
}

