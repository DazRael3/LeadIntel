import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { requireTeamPlan } from '@/lib/team/gating'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { captureServerEvent } from '@/lib/analytics/posthog-server'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const EmailStatus = z.enum(['unknown', 'candidate', 'verified', 'invalid', 'manually_confirmed'])
const SourceType = z.enum(['manual', 'csv', 'provider', 'pattern'])

const ListSchema = z.object({
  prospectId: z.string().uuid(),
})

const CreateSchema = z.object({
  prospectId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  title: z.string().trim().max(120).optional(),
  linkedinUrl: z.string().trim().url().optional(),
  email: z.string().trim().email().optional(),
  emailStatus: EmailStatus.optional(),
  sourceType: SourceType.optional(),
  sourceUrl: z.string().trim().url().optional(),
  confidenceScore: z.number().int().min(0).max(100).optional(),
})

const PatchSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120).optional(),
  firstName: z.string().trim().max(80).nullable().optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  linkedinUrl: z.string().trim().url().nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  emailStatus: EmailStatus.optional(),
  reviewerNotes: z.string().trim().max(800).nullable().optional(),
})

const SelectSchema = z.object({
  id: z.string().uuid(),
})

function isPrivileged(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager'
}

async function getAuthedWorkspace(req: NextRequest, bridge: ReturnType<typeof createCookieBridge>, requestId: string) {
  const supabase = createRouteClient(req, bridge)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return { ok: false as const, res: fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, { status: 401 }, bridge, requestId) }

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok) return { ok: false as const, res: fail(ErrorCode.FORBIDDEN, 'Team plan required', undefined, { status: 403 }, bridge, requestId) }

  const ws = await getCurrentWorkspace({ supabase, userId: user.id })
  if (!ws) return { ok: false as const, res: fail(ErrorCode.VALIDATION_ERROR, 'Workspace required', { reason: 'workspace_missing' }, { status: 422 }, bridge, requestId) }

  const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
  const role = membership?.role ?? null
  if (!membership || !isPrivileged(role)) return { ok: false as const, res: fail(ErrorCode.FORBIDDEN, 'Admin access required', { role }, { status: 403 }, bridge, requestId) }

  return { ok: true as const, supabase, user, workspaceId: ws.id }
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, query }) => {
  const bridge = createCookieBridge()
  try {
    const parsed = ListSchema.safeParse(query ?? {})
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid query', parsed.error.flatten(), { status: 400 }, bridge, requestId)

    const authed = await getAuthedWorkspace(request, bridge, requestId)
    if (!authed.ok) return authed.res

    const client = authed.supabase.schema('api')
    const { data } = await client
      .from('prospect_watch_contacts')
      .select('id, prospect_id, full_name, first_name, last_name, title, linkedin_url, email, email_status, source_type, source_url, confidence_score, selected_for_outreach, reviewer_notes, reviewed_at, reviewed_by, created_at, updated_at')
      .eq('workspace_id', authed.workspaceId)
      .eq('prospect_id', parsed.data.prospectId)
      .order('selected_for_outreach', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(50)

    return ok({ items: data ?? [] }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/prospect-watch/contacts', undefined, bridge, requestId)
  }
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, body }) => {
    const bridge = createCookieBridge()
    try {
      const parsed = CreateSchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)

      const authed = await getAuthedWorkspace(request, bridge, requestId)
      if (!authed.ok) return authed.res

      const p = parsed.data
      const client = authed.supabase.schema('api')
      const { data, error } = await client
        .from('prospect_watch_contacts')
        .insert({
          workspace_id: authed.workspaceId,
          prospect_id: p.prospectId,
          full_name: p.fullName,
          first_name: p.firstName ?? null,
          last_name: p.lastName ?? null,
          title: p.title ?? null,
          linkedin_url: p.linkedinUrl ?? null,
          email: p.email ?? null,
          email_status: p.emailStatus ?? 'unknown',
          source_type: p.sourceType ?? 'manual',
          source_url: p.sourceUrl ?? null,
          confidence_score: p.confidenceScore ?? 50,
          selected_for_outreach: false,
        })
        .select('id')
        .single()
      if (error || !data) return fail(ErrorCode.DATABASE_ERROR, 'Create failed', { message: error?.message ?? 'insert_failed' }, { status: 500 }, bridge, requestId)

      void captureServerEvent({ distinctId: authed.user.id, event: 'prospect_contact_created', properties: { workspaceId: authed.workspaceId, prospectId: p.prospectId } })
      void logProductEvent({
        userId: authed.user.id,
        eventName: 'prospect_contact_created',
        eventProps: { workspaceId: authed.workspaceId, prospectId: p.prospectId },
      })
      return ok({ created: true, id: (data as { id: string }).id }, { status: 201 }, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/prospect-watch/contacts', undefined, bridge, requestId)
    }
  },
  { bodySchema: CreateSchema }
)

export const PATCH = withApiGuard(
  async (request: NextRequest, { requestId, body }) => {
    const bridge = createCookieBridge()
    try {
      const parsed = PatchSchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)

      const authed = await getAuthedWorkspace(request, bridge, requestId)
      if (!authed.ok) return authed.res

      const patch: Record<string, unknown> = {}
      if (parsed.data.fullName !== undefined) patch.full_name = parsed.data.fullName
      if (parsed.data.firstName !== undefined) patch.first_name = parsed.data.firstName
      if (parsed.data.lastName !== undefined) patch.last_name = parsed.data.lastName
      if (parsed.data.title !== undefined) patch.title = parsed.data.title
      if (parsed.data.linkedinUrl !== undefined) patch.linkedin_url = parsed.data.linkedinUrl
      if (parsed.data.email !== undefined) patch.email = parsed.data.email
      if (parsed.data.emailStatus !== undefined) patch.email_status = parsed.data.emailStatus
      if (parsed.data.reviewerNotes !== undefined) patch.reviewer_notes = parsed.data.reviewerNotes

      // Mark reviewed when editing status/notes/email
      patch.reviewed_at = new Date().toISOString()
      patch.reviewed_by = authed.user.id

      const { error } = await authed.supabase
        .schema('api')
        .from('prospect_watch_contacts')
        .update(patch)
        .eq('workspace_id', authed.workspaceId)
        .eq('id', parsed.data.id)
      if (error) return fail(ErrorCode.DATABASE_ERROR, 'Update failed', { message: error.message }, { status: 500 }, bridge, requestId)

      void captureServerEvent({ distinctId: authed.user.id, event: 'prospect_contact_updated', properties: { workspaceId: authed.workspaceId, contactId: parsed.data.id } })
      void logProductEvent({
        userId: authed.user.id,
        eventName: 'prospect_contact_updated',
        eventProps: { workspaceId: authed.workspaceId, contactId: parsed.data.id },
      })
      return ok({ updated: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/prospect-watch/contacts', undefined, bridge, requestId)
    }
  },
  { bodySchema: PatchSchema }
)

export const PUT = withApiGuard(
  async (request: NextRequest, { requestId, body }) => {
    const bridge = createCookieBridge()
    try {
      const parsed = SelectSchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)

      const authed = await getAuthedWorkspace(request, bridge, requestId)
      if (!authed.ok) return authed.res

      const { error } = await authed.supabase.schema('api').rpc('prospect_watch_select_contact', { p_contact_id: parsed.data.id })
      if (error) {
        const msg = error.message || 'select_failed'
        const status = msg.includes('forbidden') ? 403 : msg.includes('contact_not_found') ? 404 : 500
        return fail(ErrorCode.DATABASE_ERROR, 'Select failed', { message: msg }, { status }, bridge, requestId)
      }

      void captureServerEvent({ distinctId: authed.user.id, event: 'prospect_contact_selected', properties: { workspaceId: authed.workspaceId, contactId: parsed.data.id } })
      void logProductEvent({
        userId: authed.user.id,
        eventName: 'prospect_contact_selected',
        eventProps: { workspaceId: authed.workspaceId, contactId: parsed.data.id },
      })
      return ok({ selected: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/prospect-watch/contacts', undefined, bridge, requestId)
    }
  },
  { bodySchema: SelectSchema }
)

