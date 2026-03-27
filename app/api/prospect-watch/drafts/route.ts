import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { requireTeamPlan } from '@/lib/team/gating'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { captureServerEvent } from '@/lib/analytics/posthog-server'
import { logProductEvent } from '@/lib/services/analytics'
import { logOutboundEvent } from '@/lib/outbound/events'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().max(4000).optional(),
  toEmail: z.string().email().nullable().optional(),
  // Recipient workflow (review-first, no external send)
  contactId: z.string().uuid().nullable().optional(),
  recipientReviewed: z.boolean().optional(),
  sendReady: z.boolean().optional(),
})

function isPrivileged(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager'
}

export const PATCH = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const supabase = createRouteClient(request, bridge)
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (error || !user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, { status: 401 }, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Team plan required', undefined, { status: 403 }, bridge, requestId)

      const parsed = PatchSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)

      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.VALIDATION_ERROR, 'Workspace required', { reason: 'workspace_missing' }, { status: 422 }, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      const role = membership?.role ?? null
      if (!membership || !isPrivileged(role)) return fail(ErrorCode.FORBIDDEN, 'Admin access required', { role }, { status: 403 }, bridge, requestId)

      const patch: Record<string, unknown> = {}
      if (parsed.data.subject !== undefined) patch.subject = parsed.data.subject
      if (parsed.data.body !== undefined) patch.body = parsed.data.body
      if (parsed.data.toEmail !== undefined) patch.to_email = parsed.data.toEmail
      if (parsed.data.contactId !== undefined) patch.contact_id = parsed.data.contactId

      // Recipient review / send-ready validation:
      // - cannot mark send-ready unless a contact is selected and email is verified/manually_confirmed,
      //   unless recipientReviewed is explicitly false (i.e., resetting state).
      const nowIso = new Date().toISOString()
      if (parsed.data.recipientReviewed !== undefined) {
        patch.recipient_reviewed = parsed.data.recipientReviewed
        patch.recipient_reviewed_at = parsed.data.recipientReviewed ? nowIso : null
        patch.recipient_reviewed_by = parsed.data.recipientReviewed ? user.id : null
      }
      if (parsed.data.sendReady !== undefined) {
        if (parsed.data.sendReady) {
          // Ensure we have a contact id either in patch or existing row.
          const contactId =
            (parsed.data.contactId ?? null) ??
            (
              await supabase
                .schema('api')
                .from('prospect_watch_outreach_drafts')
                .select('contact_id')
                .eq('workspace_id', ws.id)
                .eq('id', parsed.data.id)
                .maybeSingle()
            ).data?.contact_id ??
            null

          if (!contactId) {
            return fail(
              ErrorCode.VALIDATION_ERROR,
              'Recipient contact required before marking send-ready.',
              { reason: 'contact_required' },
              { status: 422 },
              bridge,
              requestId
            )
          }

          const { data: contactRow } = await supabase
            .schema('api')
            .from('prospect_watch_contacts')
            .select('email, email_status')
            .eq('workspace_id', ws.id)
            .eq('id', contactId)
            .maybeSingle()
          const email = ((contactRow as { email?: string | null } | null)?.email ?? '').trim()
          const emailStatus = (contactRow as { email_status?: string | null } | null)?.email_status ?? 'unknown'
          const okStatus = emailStatus === 'verified' || emailStatus === 'manually_confirmed'
          if (!email || !okStatus) {
            return fail(
              ErrorCode.VALIDATION_ERROR,
              'Recipient email must be verified or manually confirmed before marking send-ready.',
              { reason: 'email_not_confirmed', emailStatus },
              { status: 422 },
              bridge,
              requestId
            )
          }

          // Always mirror to_email from contact when send-ready is set.
          patch.to_email = email
          patch.recipient_reviewed = true
          patch.recipient_reviewed_at = nowIso
          patch.recipient_reviewed_by = user.id
          patch.send_ready = true
          patch.send_ready_at = nowIso
          patch.send_ready_by = user.id
        } else {
          patch.send_ready = false
          patch.send_ready_at = null
          patch.send_ready_by = null
        }
      }

      const client = supabase.schema('api')
      const { error: updErr } = await client
        .from('prospect_watch_outreach_drafts')
        .update(patch)
        .eq('workspace_id', ws.id)
        .eq('id', parsed.data.id)
      if (updErr) return fail(ErrorCode.DATABASE_ERROR, 'Update failed', { message: updErr.message }, { status: 500 }, bridge, requestId)

      void captureServerEvent({ distinctId: user.id, event: 'outreach_draft_saved', properties: { draftId: parsed.data.id, workspaceId: ws.id } })
      void logProductEvent({
        userId: user.id,
        eventName: 'outreach_draft_saved',
        eventProps: { draftId: parsed.data.id, workspaceId: ws.id },
      })
      if (parsed.data.sendReady !== undefined) {
        void logProductEvent({
          userId: user.id,
          eventName: 'outreach_draft_send_ready_set',
          eventProps: { draftId: parsed.data.id, workspaceId: ws.id, sendReady: Boolean(parsed.data.sendReady) },
        })
        void logOutboundEvent({
          supabase,
          workspaceId: ws.id,
          actorUserId: user.id,
          subjectType: 'outreach_draft',
          subjectId: parsed.data.id,
          eventType: parsed.data.sendReady ? 'send_ready_set' : 'send_ready_unset',
          channel: null,
          meta: { via: 'api/prospect-watch/drafts' },
        })
      }
      if (parsed.data.recipientReviewed !== undefined) {
        void logOutboundEvent({
          supabase,
          workspaceId: ws.id,
          actorUserId: user.id,
          subjectType: 'outreach_draft',
          subjectId: parsed.data.id,
          eventType: 'recipient_reviewed',
          channel: null,
          meta: { recipientReviewed: Boolean(parsed.data.recipientReviewed), via: 'api/prospect-watch/drafts' },
        })
      }
      return ok({ updated: true }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/prospect-watch/drafts', undefined, bridge, requestId)
    }
  },
  { bodySchema: PatchSchema }
)

