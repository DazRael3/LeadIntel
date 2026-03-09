import type { NextRequest } from 'next/server'
import { platformFail, PlatformErrorCode } from '@/lib/platform-api/responses'
import { authenticatePlatformRequest } from '@/lib/platform-api/auth'
import { hasScope } from '@/lib/platform-api/permissions'
import { checkPlatformRateLimit } from '@/lib/platform-api/rate-limits'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import type { PlatformScope } from '@/lib/platform-api/types'
import { ErrorCode } from '@/lib/api/http'
import type { PlatformAuthContext } from '@/lib/platform-api/types'

export async function withPlatformAuth(args: {
  request: NextRequest
  requestId: string
  requiredScopes?: PlatformScope[]
}): Promise<
  | { ok: true; ctx: PlatformAuthContext }
  | { ok: false; response: ReturnType<typeof platformFail> }
> {
  const auth = await authenticatePlatformRequest({ request: args.request, requestId: args.requestId })
  if (!auth.ok) {
    const code =
      auth.reason === 'missing' ? PlatformErrorCode.PLATFORM_KEY_REQUIRED : PlatformErrorCode.PLATFORM_KEY_INVALID
    const msg =
      auth.reason === 'missing'
        ? 'Missing API key'
        : auth.reason === 'revoked'
          ? 'API key revoked'
          : auth.reason === 'unavailable'
            ? 'Platform API not configured'
            : 'Invalid API key'
    return { ok: false, response: platformFail(code, msg, undefined, { status: 401 }, args.requestId) }
  }

  const required = args.requiredScopes ?? []
  if (required.length > 0 && !hasScope({ scopes: auth.ctx.scopes, required })) {
    return {
      ok: false,
      response: platformFail(
        PlatformErrorCode.PLATFORM_SCOPE_REQUIRED,
        'Insufficient scope',
        { requiredScopes: required },
        { status: 403 },
        args.requestId
      ),
    }
  }

  // Workspace policy gate: disable API access when turned off.
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { policies } = await getWorkspacePolicies({ supabase: admin, workspaceId: auth.ctx.workspaceId })
  if (!policies.platform.apiAccessEnabled) {
    return { ok: false, response: platformFail(ErrorCode.FORBIDDEN, 'API access disabled', undefined, { status: 403 }, args.requestId) }
  }

  // Rate limiting (best-effort; null means disabled).
  const rl = await checkPlatformRateLimit({
    request: args.request,
    apiKeyId: auth.ctx.apiKeyId,
    route: new URL(args.request.url).pathname,
    category: 'READ',
  })
  if (rl && !rl.success) {
    return {
      ok: false,
      response: platformFail(PlatformErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', { limit: rl.limit, reset: rl.reset }, { status: 429 }, args.requestId),
    }
  }

  // Best-effort: update key last-used + insert request log skeleton (status filled by callers).
  try {
    await admin
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        last_used_ip: args.request.headers.get('x-forwarded-for') ?? null,
        last_used_user_agent: args.request.headers.get('user-agent') ?? null,
      })
      .eq('id', auth.ctx.apiKeyId)
  } catch {
    // ignore
  }

  return { ok: true, ctx: auth.ctx }
}

export async function logPlatformRequest(args: {
  workspaceId: string
  apiKeyId: string
  method: string
  route: string
  status: number
  errorCode: string | null
  requestId: string | null
  latencyMs: number | null
}): Promise<void> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  await admin.from('api_request_logs').insert({
    workspace_id: args.workspaceId,
    api_key_id: args.apiKeyId,
    method: args.method,
    route: args.route,
    status: args.status,
    error_code: args.errorCode,
    request_id: args.requestId,
    latency_ms: args.latencyMs,
  })
}

