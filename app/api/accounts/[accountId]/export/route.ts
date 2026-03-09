import { NextRequest } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'
import { toCsv } from '@/lib/exports/csv'
import { uploadExportCsv } from '@/lib/exports/storage'
import { logAudit } from '@/lib/audit/log'
import { enqueueWebhookEvent } from '@/lib/integrations/webhooks'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional(),
})

type DbLeadRow = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
}

function extractAccountIdFromPath(pathname: string): string | null {
  // /api/accounts/[accountId]/export
  const parts = pathname.split('/').filter(Boolean)
  const accountId = parts.at(-2)
  return typeof accountId === 'string' && accountId.trim().length > 0 ? accountId : null
}

function buildRecommendedOpener(args: {
  companyName: string
  momentumLabel: string
  topSignalTitle: string | null
}): string {
  const why = args.topSignalTitle ? `Noticed: ${args.topSignalTitle}.` : `Noticed ${args.momentumLabel} momentum on your watchlist.`
  return `${why} Quick question: what’s driving priority for ${args.companyName} right now—pipeline creation, conversion, or standardizing outbound?\n\nWorth 10 minutes this week?`
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

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const { data: lead, error: leadError } = await supabase
        .schema('api')
        .from('leads')
        .select('id, company_name, company_domain, company_url')
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

      const topSignals = explainability.signals.slice(0, 5).map((s) => s.title.trim()).filter(Boolean)
      const topSignalTitle = topSignals[0] ?? null
      const momentumLabel = explainability.momentum?.label ?? 'steady'
      const opener = buildRecommendedOpener({ companyName, momentumLabel, topSignalTitle })

      const csv = toCsv([
        {
          account_id: String(leadRow.id),
          company_name: companyName,
          company_domain: String(leadRow.company_domain ?? ''),
          company_url: String(leadRow.company_url ?? ''),
          score: String(explainability.scoreExplainability.score),
          score_delta: String(explainability.momentum?.delta ?? 0),
          momentum: String(momentumLabel),
          top_signals: topSignals.join(' | '),
          recommended_opener: opener,
        },
      ])

      const { data: job, error: jobErr } = await supabase
        .schema('api')
        .from('export_jobs')
        .insert({
          workspace_id: workspace.id,
          created_by: user.id,
          type: 'accounts',
          status: 'pending',
        })
        .select('id')
        .single()

      if (jobErr || !job?.id) return fail(ErrorCode.DATABASE_ERROR, 'Create failed', undefined, undefined, bridge, requestId)

      const uploaded = await uploadExportCsv({ workspaceId: workspace.id, jobId: job.id, csv })
      const nowIso = new Date().toISOString()
      await supabase
        .schema('api')
        .from('export_jobs')
        .update({ status: 'ready', file_path: uploaded.filePath, ready_at: nowIso, error: null })
        .eq('id', job.id)
        .eq('workspace_id', workspace.id)

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'account.exported',
        targetType: 'lead',
        targetId: accountId,
        meta: { exportJobId: job.id, type: 'accounts' },
        request,
      })

      await enqueueWebhookEvent({
        workspaceId: workspace.id,
        eventType: 'account.exported',
        eventId: job.id,
        payload: {
          account: {
            id: accountId,
            companyName,
            companyDomain: leadRow.company_domain,
            companyUrl: leadRow.company_url,
            score: explainability.scoreExplainability.score,
            momentum: explainability.momentum ? { label: explainability.momentum.label, delta: explainability.momentum.delta } : null,
            topSignals: topSignals.slice(0, 5),
            opener,
          },
          exportJobId: job.id,
          createdAt: nowIso,
        },
      })

      return ok({ jobId: job.id }, { status: 201 }, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/accounts/[accountId]/export', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

