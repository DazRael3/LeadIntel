import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { extractCurlyTokens, normalizeSlug, validateCurlyTokensOnly } from '@/lib/templates/workspace-templates'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

function containsBracketTokens(input: string): boolean {
  return input.includes('[') || input.includes(']')
}

const CreateSchema = z.object({
  setId: z.string().uuid().nullable(),
  slug: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  channel: z.enum(['email', 'linkedin_dm', 'call_opener']),
  trigger: z.string().trim().min(1).max(120),
  persona: z.string().trim().min(1).max(120),
  length: z.string().trim().min(1).max(40),
  subject: z.string().trim().max(180).nullable().optional(),
  body: z.string().trim().min(1).max(5000),
})

const UpdateSchema = CreateSchema.extend({
  id: z.string().uuid(),
})

const QuerySchema = z.object({
  setId: z.string().uuid().optional(),
  status: z.enum(['draft', 'approved']).optional(),
})

const DeleteQuerySchema = z.object({
  id: z.string().uuid(),
})

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId, query }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsedQuery = QuerySchema.safeParse(query ?? {})
      if (!parsedQuery.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsedQuery.error.flatten(), undefined, bridge, requestId)
      }

      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) {
        return ok({ configured: false, reason: 'workspace_missing', workspace: null, role: 'viewer', templates: [] }, undefined, bridge, requestId)
      }

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      let q = supabase
        .schema('api')
        .from('templates')
        .select(
          'id, workspace_id, set_id, slug, title, channel, trigger, persona, length, subject, body, tokens, status, created_by, approved_by, approved_at, created_at'
        )
        .eq('workspace_id', workspace.id)

      if (parsedQuery.data.setId) q = q.eq('set_id', parsedQuery.data.setId)
      if (parsedQuery.data.status) q = q.eq('status', parsedQuery.data.status)

      const { data: templates, error } = await q.order('created_at', { ascending: false }).limit(200)
      if (error) return fail(ErrorCode.DATABASE_ERROR, 'Failed to load templates', undefined, undefined, bridge, requestId)

      return ok({ workspace, role: membership.role, templates: templates ?? [] }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/templates', userId, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = CreateSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'Workspace required',
          { workspace: 'Create or select a workspace before managing templates.' },
          { status: 422 },
          bridge,
          requestId
        )
      }

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const slug = normalizeSlug(parsed.data.slug)
      if (!slug) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', { slug: 'Invalid slug' }, undefined, bridge, requestId)

      const subject = typeof parsed.data.subject === 'string' ? parsed.data.subject : null
      const bodyText = parsed.data.body

      const subjectCheck = subject ? validateCurlyTokensOnly(subject) : { ok: true as const }
      if (!subjectCheck.ok) {
        return fail(ErrorCode.VALIDATION_ERROR, subjectCheck.message, undefined, undefined, bridge, requestId)
      }
      const bodyCheck = validateCurlyTokensOnly(bodyText)
      if (!bodyCheck.ok) {
        return fail(ErrorCode.VALIDATION_ERROR, bodyCheck.message, undefined, undefined, bridge, requestId)
      }
      if (containsBracketTokens(subject ?? '') || containsBracketTokens(bodyText)) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Curly tokens only. Use {{token}} format.', undefined, undefined, bridge, requestId)
      }

      const tokens = Array.from(new Set([...extractCurlyTokens(subject ?? ''), ...extractCurlyTokens(bodyText)]))

      const { data: template, error } = await supabase
        .schema('api')
        .from('templates')
        .insert({
          workspace_id: workspace.id,
          set_id: parsed.data.setId,
          slug,
          title: parsed.data.title,
          channel: parsed.data.channel,
          trigger: parsed.data.trigger,
          persona: parsed.data.persona,
          length: parsed.data.length,
          subject,
          body: bodyText,
          tokens,
          status: 'draft',
          created_by: user.id,
        })
        .select(
          'id, workspace_id, set_id, slug, title, channel, trigger, persona, length, subject, body, tokens, status, created_by, approved_by, approved_at, created_at'
        )
        .single()

      if (error || !template) {
        return fail(ErrorCode.DATABASE_ERROR, 'Create failed', undefined, undefined, bridge, requestId)
      }

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'template.created',
        targetType: 'template',
        targetId: template.id,
        meta: { slug, channel: parsed.data.channel },
        request,
      })

      return ok({ template }, { status: 201 }, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/templates', userId, bridge, requestId)
    }
  },
  { bodySchema: CreateSchema }
)

export const PATCH = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = UpdateSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'Workspace required',
          { workspace: 'Create or select a workspace before managing templates.' },
          { status: 422 },
          bridge,
          requestId
        )
      }

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const slug = normalizeSlug(parsed.data.slug)
      if (!slug) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', { slug: 'Invalid slug' }, undefined, bridge, requestId)

      const subject = typeof parsed.data.subject === 'string' ? parsed.data.subject : null
      const bodyText = parsed.data.body

      const subjectCheck = subject ? validateCurlyTokensOnly(subject) : { ok: true as const }
      if (!subjectCheck.ok) return fail(ErrorCode.VALIDATION_ERROR, subjectCheck.message, undefined, undefined, bridge, requestId)
      const bodyCheck = validateCurlyTokensOnly(bodyText)
      if (!bodyCheck.ok) return fail(ErrorCode.VALIDATION_ERROR, bodyCheck.message, undefined, undefined, bridge, requestId)
      if (containsBracketTokens(subject ?? '') || containsBracketTokens(bodyText)) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Curly tokens only. Use {{token}} format.', undefined, undefined, bridge, requestId)
      }

      const tokens = Array.from(new Set([...extractCurlyTokens(subject ?? ''), ...extractCurlyTokens(bodyText)]))

      const { data: template, error } = await supabase
        .schema('api')
        .from('templates')
        .update({
          set_id: parsed.data.setId,
          slug,
          title: parsed.data.title,
          channel: parsed.data.channel,
          trigger: parsed.data.trigger,
          persona: parsed.data.persona,
          length: parsed.data.length,
          subject,
          body: bodyText,
          tokens,
          // Editing reverts approval so governance is enforced.
          status: 'draft',
          approved_by: null,
          approved_at: null,
        })
        .eq('id', parsed.data.id)
        .eq('workspace_id', workspace.id)
        .select(
          'id, workspace_id, set_id, slug, title, channel, trigger, persona, length, subject, body, tokens, status, created_by, approved_by, approved_at, created_at'
        )
        .single()

      if (error || !template) return fail(ErrorCode.DATABASE_ERROR, 'Save failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'template.updated',
        targetType: 'template',
        targetId: template.id,
        meta: { slug, channel: parsed.data.channel },
        request,
      })

      return ok({ template }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/templates', userId, bridge, requestId)
    }
  },
  { bodySchema: UpdateSchema }
)

export const DELETE = withApiGuard(
  async (request: NextRequest, { requestId, userId, query }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsedQuery = DeleteQuerySchema.safeParse(query ?? {})
      if (!parsedQuery.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsedQuery.error.flatten(), undefined, bridge, requestId)
      }
      const id = parsedQuery.data.id

      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'Workspace required',
          { workspace: 'Create or select a workspace before managing templates.' },
          { status: 422 },
          bridge,
          requestId
        )
      }

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const { error } = await supabase.schema('api').from('templates').delete().eq('id', id).eq('workspace_id', workspace.id)
      if (error) return fail(ErrorCode.DATABASE_ERROR, 'Delete failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'template.deleted',
        targetType: 'template',
        targetId: id,
        meta: {},
        request,
      })

      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/templates', userId, bridge, requestId)
    }
  },
  { querySchema: DeleteQuerySchema }
)

