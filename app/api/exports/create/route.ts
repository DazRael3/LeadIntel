import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { toCsv } from '@/lib/exports/csv'
import { uploadExportCsv } from '@/lib/exports/storage'
import { logAudit } from '@/lib/audit/log'
import { serverEnv } from '@/lib/env'
import { logProductEvent } from '@/lib/services/analytics'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  type: z.enum(['accounts', 'signals', 'templates', 'pitches']),
})

function isoMinutesAgo(m: number): string {
  return new Date(Date.now() - m * 60 * 1000).toISOString()
}

function safeErr(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.length > 160 ? msg.slice(0, 157) + '...' : msg
}

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'governance_exports' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: workspace.id })
      if (!policies.exports.allowedRoles.includes(membership.role)) {
        return fail(
          ErrorCode.FORBIDDEN,
          'Export restricted by workspace policy',
          { role: `Role ${membership.role} cannot export in this workspace` },
          undefined,
          bridge,
          requestId
        )
      }

      // Idempotency (best-effort): reuse a recently-created pending job for the same export type.
      // This prevents double-creation under retries or rapid repeated clicks.
      const since = isoMinutesAgo(2)
      const { data: existingPending } = await supabase
        .schema('api')
        .from('export_jobs')
        .select('id, created_at')
        .eq('workspace_id', workspace.id)
        .eq('created_by', user.id)
        .eq('type', parsed.data.type)
        .eq('status', 'pending')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingPending?.id) {
        return ok({ jobId: existingPending.id, reused: true }, { status: 202 }, bridge, requestId)
      }

      // Create job row first (RLS allows admin insert).
      const { data: job, error: jobErr } = await supabase
        .schema('api')
        .from('export_jobs')
        .insert({
          workspace_id: workspace.id,
          created_by: user.id,
          type: parsed.data.type,
          status: 'pending',
        })
        .select('id, workspace_id, created_by, type, status, file_path, error, created_at, ready_at')
        .single()

      if (jobErr || !job) return fail(ErrorCode.DATABASE_ERROR, 'Create failed', undefined, undefined, bridge, requestId)

      try {
        let csv = ''
        if (parsed.data.type === 'accounts') {
          const { data: rows } = await supabase.schema('api').from('leads').select('id, company_name, company_domain, company_url, created_at').order('created_at', { ascending: false }).limit(5000)
          csv = toCsv(
            (rows ?? []).map((r: any) => ({
              id: String(r.id ?? ''),
              company_name: String(r.company_name ?? ''),
              company_domain: String(r.company_domain ?? ''),
              company_url: String(r.company_url ?? ''),
              created_at: String(r.created_at ?? ''),
            }))
          )
        } else if (parsed.data.type === 'signals') {
          const { data: rows } = await supabase
            .schema('api')
            .from('trigger_events')
            .select('id, lead_id, event_type, created_at, payload')
            .order('created_at', { ascending: false })
            .limit(5000)
          csv = toCsv(
            (rows ?? []).map((r: any) => ({
              id: String(r.id ?? ''),
              lead_id: String(r.lead_id ?? ''),
              event_type: String(r.event_type ?? ''),
              created_at: String(r.created_at ?? ''),
              payload: r.payload ? JSON.stringify(r.payload) : '',
            }))
          )
        } else if (parsed.data.type === 'templates') {
          const { data: rows } = await supabase
            .schema('api')
            .from('templates')
            .select('id, slug, title, channel, trigger, persona, length, subject, body, tokens, status, approved_at, created_at')
            .eq('workspace_id', workspace.id)
            .order('created_at', { ascending: false })
            .limit(5000)
          csv = toCsv(
            (rows ?? []).map((r: any) => ({
              id: String(r.id ?? ''),
              slug: String(r.slug ?? ''),
              title: String(r.title ?? ''),
              channel: String(r.channel ?? ''),
              trigger: String(r.trigger ?? ''),
              persona: String(r.persona ?? ''),
              length: String(r.length ?? ''),
              subject: String(r.subject ?? ''),
              body: String(r.body ?? ''),
              tokens: Array.isArray(r.tokens) ? (r.tokens as string[]).join(' ') : '',
              status: String(r.status ?? ''),
              approved_at: String(r.approved_at ?? ''),
              created_at: String(r.created_at ?? ''),
            }))
          )
        } else {
          const { data: rows } = await supabase.schema('api').from('pitches').select('id, lead_id, created_at, content').order('created_at', { ascending: false }).limit(5000)
          csv = toCsv(
            (rows ?? []).map((r: any) => ({
              id: String(r.id ?? ''),
              lead_id: String(r.lead_id ?? ''),
              created_at: String(r.created_at ?? ''),
              content: String(r.content ?? ''),
            }))
          )
        }

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
          action: 'export.created',
          targetType: 'export_job',
          targetId: job.id,
          meta: { type: parsed.data.type },
          request,
        })

        if (serverEnv.ENABLE_PRODUCT_ANALYTICS === '1' || serverEnv.ENABLE_PRODUCT_ANALYTICS === 'true') {
          try {
            await logProductEvent({
              userId: user.id,
              eventName: 'export_succeeded',
              eventProps: { jobId: job.id, type: parsed.data.type },
            })
          } catch {
            // best-effort
          }
        }

        return ok({ jobId: job.id }, { status: 201 }, bridge, requestId)
      } catch (err) {
        await supabase
          .schema('api')
          .from('export_jobs')
          .update({ status: 'failed', error: err instanceof Error ? err.message : 'Export failed' })
          .eq('id', job.id)
          .eq('workspace_id', workspace.id)

        await logAudit({
          supabase,
          workspaceId: workspace.id,
          actorUserId: user.id,
          action: 'export.failed',
          targetType: 'export_job',
          targetId: job.id,
          meta: { type: parsed.data.type, error: safeErr(err) },
          request,
        })

        if (serverEnv.ENABLE_PRODUCT_ANALYTICS === '1' || serverEnv.ENABLE_PRODUCT_ANALYTICS === 'true') {
          try {
            await logProductEvent({
              userId: user.id,
              eventName: 'export_failed',
              eventProps: { jobId: job.id, type: parsed.data.type, error: safeErr(err) },
            })
          } catch {
            // best-effort
          }
        }

        return fail(ErrorCode.INTERNAL_ERROR, 'Export failed', undefined, undefined, bridge, requestId)
      }
    } catch (error) {
      return asHttpError(error, '/api/exports/create', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

