import { NextRequest } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'
import { enqueueWebhookEvent } from '@/lib/integrations/webhooks'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional(),
})

type DbLeadRow = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  ai_personalized_pitch: string | null
}

function extractAccountIdFromPath(pathname: string): string | null {
  // /api/accounts/[accountId]/push
  const parts = pathname.split('/').filter(Boolean)
  const accountId = parts.at(-2)
  return typeof accountId === 'string' && accountId.trim().length > 0 ? accountId : null
}

function truncateText(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return t.slice(0, Math.max(0, max - 3)) + '...'
}

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const accountId = extractAccountIdFromPath(new URL(request.url).pathname)
      if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'planning_intelligence' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { data: lead, error: leadError } = await supabase
        .schema('api')
        .from('leads')
        .select('id, company_name, company_domain, company_url, ai_personalized_pitch')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (leadError || !lead) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)
      const leadRow = lead as unknown as DbLeadRow
      const companyName = (leadRow.company_name ?? '').trim() || 'Unknown company'

      const explainability = await getAccountExplainability({
        supabase,
        userId: user.id,
        accountId,
        window: parsed.data.window ?? '30d',
        type: null,
        sort: 'recent',
        limit: 50,
      })
      if (!explainability) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)

      const { data: latestBrief } = await supabase
        .from('user_reports')
        .select('id, created_at, report_markdown')
        .eq('user_id', user.id)
        .eq('report_kind', 'account_brief')
        .eq('meta->>leadId', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const briefSummary =
        latestBrief && typeof (latestBrief as { report_markdown?: unknown }).report_markdown === 'string'
          ? truncateText((latestBrief as { report_markdown: string }).report_markdown, 1200)
          : null

      const topSignals = explainability.signals.slice(0, 5).map((s) => ({
        type: s.type,
        title: s.title,
        detectedAt: s.detectedAt,
        occurredAt: s.occurredAt,
        sourceUrl: s.sourceUrl,
        confidence: s.confidence,
      }))

      const opener =
        typeof leadRow.ai_personalized_pitch === 'string' && leadRow.ai_personalized_pitch.trim().length > 0
          ? truncateText(leadRow.ai_personalized_pitch, 1200)
          : null

      const eventId = crypto.randomUUID()
      const nowIso = new Date().toISOString()

      await enqueueWebhookEvent({
        workspaceId: workspace.id,
        eventType: 'account.pushed',
        eventId,
        payload: {
          account: {
            id: accountId,
            companyName,
            companyDomain: leadRow.company_domain,
            companyUrl: leadRow.company_url,
            score: explainability.scoreExplainability.score,
            momentum: explainability.momentum ? { label: explainability.momentum.label, delta: explainability.momentum.delta } : null,
            topSignals,
          },
          briefSummary,
          opener,
          pushedBy: { userId: user.id, role: membership.role },
          pushedAt: nowIso,
        },
      })

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'account.pushed',
        targetType: 'lead',
        targetId: accountId,
        meta: { eventId },
        request,
      })

      return ok({ eventId }, { status: 202 }, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/accounts/[accountId]/push', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

