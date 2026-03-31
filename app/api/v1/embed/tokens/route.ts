import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getRequestId } from '@/lib/api/with-request-id'
import { platformFail, platformOk } from '@/lib/platform-api/responses'
import { withPlatformAuth, logPlatformRequest } from '@/lib/platform-api/middleware'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { signEmbedToken } from '@/lib/embed/security'
import { ErrorCode } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  kind: z.enum(['account_summary', 'shortlist', 'readiness']),
  accountId: z.string().uuid().optional(),
  expiresInMinutes: z.coerce.number().int().min(5).max(60).optional().default(30),
})

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  const started = Date.now()
  const path = new URL(request.url).pathname

  const authed = await withPlatformAuth({ request, requestId, requiredScopes: ['embed.token.create'], rateLimitCategory: 'WRITE' })
  if (!authed.ok) return authed.response

  let bodyJson: unknown = null
  try {
    bodyJson = await request.json()
  } catch {
    bodyJson = null
  }
  const parsed = BodySchema.safeParse(bodyJson)
  if (!parsed.success) return platformFail(ErrorCode.VALIDATION_ERROR, 'Invalid body', parsed.error.flatten(), { status: 400 }, requestId)

  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { policies } = await getWorkspacePolicies({ supabase: admin, workspaceId: authed.ctx.workspaceId })
    if (!policies.platform.embedEnabled) {
      return platformFail(ErrorCode.FORBIDDEN, 'Embeds disabled for this workspace', undefined, { status: 403 }, requestId)
    }

    // If embedding an account-specific widget, ensure the account belongs to this workspace.
    if (parsed.data.accountId) {
      const { data: acct } = await admin
        .from('account_program_accounts')
        .select('id')
        .eq('workspace_id', authed.ctx.workspaceId)
        .eq('lead_id', parsed.data.accountId)
        .limit(1)
        .maybeSingle()
      if (!acct) {
        return platformFail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, requestId)
      }
    }

    const exp = Math.floor(Date.now() / 1000) + parsed.data.expiresInMinutes * 60
    const token = signEmbedToken({
      v: 1,
      workspaceId: authed.ctx.workspaceId,
      kind: parsed.data.kind,
      ...(parsed.data.accountId ? { accountId: parsed.data.accountId } : {}),
      exp,
    })

    const res = platformOk({ token, expiresAt: new Date(exp * 1000).toISOString() }, { status: 201 }, requestId)
    await logPlatformRequest({
      workspaceId: authed.ctx.workspaceId,
      apiKeyId: authed.ctx.apiKeyId,
      method: 'POST',
      route: path,
      status: 201,
      errorCode: null,
      requestId,
      latencyMs: Date.now() - started,
    }).catch(() => undefined)
    return res
  } catch {
    const res = platformFail(ErrorCode.INTERNAL_ERROR, 'Request failed', undefined, { status: 500 }, requestId)
    await logPlatformRequest({
      workspaceId: authed.ctx.workspaceId,
      apiKeyId: authed.ctx.apiKeyId,
      method: 'POST',
      route: path,
      status: 500,
      errorCode: ErrorCode.INTERNAL_ERROR,
      requestId,
      latencyMs: Date.now() - started,
    }).catch(() => undefined)
    return res
  }
}

