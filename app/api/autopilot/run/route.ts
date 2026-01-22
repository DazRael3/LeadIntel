import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, asHttpError, ErrorCode, fail } from '@/lib/api/http'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendEmailWithResend } from '@/lib/email/resend'
import { insertEmailLog } from '@/lib/email/email-logs'
import { renderSimplePitchEmailHtml } from '@/lib/email/templates'
import { captureBreadcrumb, captureException, captureMessage } from '@/lib/observability/sentry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AutopilotRunSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  limitUsers: z.number().int().min(1).max(200).optional(),
  limitLeadsPerUser: z.number().int().min(1).max(200).optional(),
  userId: z.string().uuid().optional(),
})

type AutopilotFailure = {
  userId: string
  leadId?: string
  code: string
  message: string
}

const MAX_AUTOPILOT_EMAILS_PER_USER_PER_DAY = 10

function startOfDayIso(now: Date): string {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function isEmail(value: string): boolean {
  // Basic, non-regex-heavy check; detailed validation is handled at user input time.
  return value.includes('@') && value.includes('.')
}

function subjectForStep(companyName: string, step: number): string {
  if (step === 1) return `Quick intelligence on ${companyName}`
  if (step === 2) return `A few data points for ${companyName}`
  return `Final note on ${companyName}`
}

function pickSequencePart(sequence: unknown, step: number): string | null {
  if (!sequence || typeof sequence !== 'object') return null
  const seq = sequence as { part1?: unknown; part2?: unknown; part3?: unknown }
  const val = step === 1 ? seq.part1 : step === 2 ? seq.part2 : seq.part3
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : null
}

export const POST = withApiGuard(
  async (request: NextRequest, { body, isCron, userId: sessionUserId, requestId }) => {
    // This endpoint is intended for cron. If called by a user session, we still allow it
    // (policy requires auth), but all DB access is done via service role to avoid RLS issues.
    // If neither cron nor user auth is present, guard will block before reaching here.
    try {
      const input = (body || {}) as z.infer<typeof AutopilotRunSchema>
      const parsed = AutopilotRunSchema.safeParse(input)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, undefined, requestId)
      }

      captureBreadcrumb({
        category: 'autopilot',
        level: 'info',
        message: 'autopilot_run_start',
        data: {
          route: '/api/autopilot/run',
          requestId,
          isCron,
          dryRun: parsed.data.dryRun,
          targetedUserId: parsed.data.userId ? 'yes' : 'no',
        },
      })

      const now = new Date()
      const dayStart = startOfDayIso(now)

      const supabaseAdmin = createSupabaseAdminClient()

      // Determine which tenants to process.
      // - Cron runs: only tenants with autopilot_enabled = true
      // - Manual runs (authenticated): only the caller's tenant; allows dryRun even if disabled
      let targetUserIds: string[] = []

      if (isCron) {
        if (parsed.data.userId) {
          // Cron can be targeted to a single tenant (still gated by autopilot_enabled unless dryRun).
          targetUserIds = [parsed.data.userId]
        } else {
          const { data: enabledSettings, error: enabledError } = await supabaseAdmin
            .from('user_settings')
            .select('user_id')
            .eq('autopilot_enabled', true)
            .limit(parsed.data.limitUsers ?? 50)

          if (enabledError) {
            return fail(ErrorCode.DATABASE_ERROR, 'Failed to fetch autopilot settings', undefined, undefined, undefined, requestId)
          }
          targetUserIds = (enabledSettings || []).map((r) => (r as { user_id: string }).user_id)
        }
      } else {
        // Manual run: restricted to authenticated caller
        if (!sessionUserId) {
          return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, undefined, requestId)
        }
        targetUserIds = [sessionUserId]
      }

      if (targetUserIds.length === 0) {
        return ok(
          {
            mode: isCron ? 'cron' : 'user',
            usersProcessed: 0,
            leadsProcessed: 0,
            emailsAttempted: 0,
            successfulSends: 0,
            failureCount: 0,
            failures: [],
          },
          undefined,
          undefined,
          requestId
        )
      }

      // Enforce Pro tier and rollout gate
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id')
        .in('id', targetUserIds)
        .eq('subscription_tier', 'pro')
        .limit(parsed.data.limitUsers ?? 50)

      if (usersError) {
        captureException(usersError, { route: '/api/autopilot/run', requestId, isCron })
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to fetch users', undefined, undefined, undefined, requestId)
      }

      // For targeted runs, confirm autopilot_enabled (unless manual dryRun)
      if (isCron && parsed.data.userId) {
        const { data: s } = await supabaseAdmin
          .from('user_settings')
          .select('autopilot_enabled')
          .eq('user_id', parsed.data.userId)
          .maybeSingle()
        const enabled = Boolean((s as { autopilot_enabled?: boolean } | null)?.autopilot_enabled)
        if (!enabled && !parsed.data.dryRun) {
          captureMessage('autopilot_disabled_for_tenant', {
            route: '/api/autopilot/run',
            requestId,
            isCron: true,
          })
          return ok(
            {
              mode: 'cron',
              usersProcessed: 0,
              leadsProcessed: 0,
              emailsAttempted: 0,
              successfulSends: 0,
              failureCount: 1,
              failures: [
                {
                  userId: parsed.data.userId,
                  leadId: null,
                  code: ErrorCode.FORBIDDEN,
                  message: 'Autopilot disabled for tenant',
                },
              ],
            },
            undefined,
            undefined,
            requestId
          )
        }
      }

      if (!isCron) {
        // Manual non-dry-run requires autopilot_enabled
        const { data: s } = await supabaseAdmin
          .from('user_settings')
          .select('autopilot_enabled')
          .eq('user_id', sessionUserId)
          .maybeSingle()
        const enabled = Boolean((s as { autopilot_enabled?: boolean } | null)?.autopilot_enabled)
        if (!enabled && !parsed.data.dryRun) {
          captureMessage('autopilot_disabled_manual', { route: '/api/autopilot/run', requestId, isCron: false })
          return fail(ErrorCode.FORBIDDEN, 'Autopilot is disabled. Enable it in Settings first.', undefined, undefined, undefined, requestId)
        }
      }

      const failures: AutopilotFailure[] = []
      let usersProcessed = 0
      let leadsProcessed = 0
      let emailsAttempted = 0
      let successfulSends = 0

      for (const u of users || []) {
        usersProcessed++
        const userId = (u as { id: string }).id

        // Daily per-user cap via email_logs
        let sentToday = 0
        try {
          const { count } = await supabaseAdmin
            .from('email_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('kind', 'autopilot')
            .gte('created_at', dayStart)
          sentToday = count ?? 0
        } catch {
          // If schema is behind (kind/created_at), fall back to 0 and continue safely.
          sentToday = 0
        }

        const remaining = Math.max(0, MAX_AUTOPILOT_EMAILS_PER_USER_PER_DAY - sentToday)
        if (remaining <= 0) continue

        // Sender identity from user_settings (best-effort)
        let senderName = 'LeadIntel Team'
        let senderEmail = request.headers.get('x-autopilot-from-email') || undefined
        try {
          const { data: settings } = await supabaseAdmin
            .from('user_settings')
            .select('sender_name, from_email')
            .eq('user_id', userId)
            .maybeSingle()
          if (settings?.sender_name) senderName = settings.sender_name
          if (!senderEmail && settings?.from_email) senderEmail = settings.from_email
        } catch {
          // ignore
        }
        const fromEmail = senderEmail || 'noreply@leadintel.com'

        // Eligible leads: must have contact_email and email_sequence
        const { data: leads, error: leadsError } = await supabaseAdmin
          .from('leads')
          .select('id, company_name, contact_email, ai_personalized_pitch, email_sequence')
          .eq('user_id', userId)
          .not('email_sequence', 'is', null)
          .not('contact_email', 'is', null)
          .limit(Math.min(parsed.data.limitLeadsPerUser ?? remaining, remaining))

        if (leadsError) {
          captureException(leadsError, { route: '/api/autopilot/run', requestId, isCron, userId })
          failures.push({ userId, code: ErrorCode.DATABASE_ERROR, message: 'Failed to fetch leads' })
          continue
        }

        for (const lead of leads || []) {
          const leadRow = lead as {
            id: string
            company_name: string | null
            contact_email: string | null
            ai_personalized_pitch: string | null
            email_sequence: unknown
          }

          leadsProcessed++

          try {
            const toEmail = leadRow.contact_email
            if (!toEmail || !isEmail(toEmail)) {
              captureBreadcrumb({
                category: 'autopilot',
                level: 'warning',
                message: 'lead_skipped_invalid_contact_email',
                data: { route: '/api/autopilot/run', requestId, userId, leadId: leadRow.id },
              })
              failures.push({
                userId,
                leadId: leadRow.id,
                code: ErrorCode.VALIDATION_ERROR,
                message: 'Missing or invalid contact_email',
              })
              continue
            }

            // Determine next sequence step (1..3)
            let nextStep = 1
            try {
              const { data: lastLog } = await supabaseAdmin
                .from('email_logs')
                .select('sequence_step')
                .eq('user_id', userId)
                .eq('lead_id', leadRow.id)
                .eq('kind', 'autopilot')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
              const lastStep = (lastLog as { sequence_step?: number } | null)?.sequence_step
              if (typeof lastStep === 'number' && lastStep >= 1 && lastStep <= 3) {
                nextStep = Math.min(3, lastStep + 1)
              }
            } catch {
              // ignore schema mismatch
            }

            const companyName = leadRow.company_name || 'your company'
            const subject = subjectForStep(companyName, nextStep)

            const stepBody =
              pickSequencePart(leadRow.email_sequence, nextStep) ||
              leadRow.ai_personalized_pitch ||
              `I put together a short intelligence snapshot on ${companyName}.`

            const html = renderSimplePitchEmailHtml({
              brandName: 'LeadIntel',
              recipientName: undefined,
              senderName,
              pitchText: stepBody,
              footerText: 'This email was sent via LeadIntel.',
            })
            const text = `Hi there,\n\n${stepBody}\n\nBest regards,\n${senderName}\nLeadIntel Autonomous Revenue Agent`

            emailsAttempted++

            let resendMessageId: string | null = null
            let status: 'sent' | 'failed' | 'dry_run' = parsed.data.dryRun ? 'dry_run' : 'sent'

            if (!parsed.data.dryRun) {
              const sendResult = await sendEmailWithResend({
                from: `${senderName} <${fromEmail}>`,
                to: toEmail,
                subject,
                html,
                text,
                tags: [
                  { name: 'kind', value: 'autopilot' },
                  { name: 'sequence_step', value: String(nextStep) },
                ],
              })
              if (!sendResult.ok) {
                status = 'failed'
                captureMessage('autopilot_resend_send_failed', {
                  route: '/api/autopilot/run',
                  requestId,
                  userId,
                  leadId: leadRow.id,
                  provider: 'resend',
                })
              } else {
                resendMessageId = sendResult.messageId
              }
            }

            const logResult = await insertEmailLog(supabaseAdmin, {
              userId,
              leadId: leadRow.id,
              toEmail,
              fromEmail,
              subject,
              provider: 'resend',
              status,
              error: status === 'failed' ? 'Resend send failed' : null,
              resendMessageId,
              sequenceStep: nextStep,
              kind: 'autopilot',
            })

            if (!logResult.ok) {
              captureMessage('autopilot_email_log_write_failed', {
                route: '/api/autopilot/run',
                requestId,
                userId,
                leadId: leadRow.id,
              })
              failures.push({
                userId,
                leadId: leadRow.id,
                code: ErrorCode.DATABASE_ERROR,
                message: 'Failed to write email log',
              })
            }

            if (status === 'sent' || status === 'dry_run') {
              successfulSends++
            } else {
              failures.push({
                userId,
                leadId: leadRow.id,
                code: ErrorCode.EXTERNAL_API_ERROR,
                message: 'Failed to send email',
              })
            }
          } catch (err) {
            captureException(err, {
              route: '/api/autopilot/run',
              requestId,
              isCron,
              userId,
              leadId: (lead as { id: string }).id,
              provider: 'resend',
            })
            failures.push({
              userId,
              leadId: (lead as { id: string }).id,
              code: ErrorCode.INTERNAL_ERROR,
              message: err instanceof Error ? err.message : 'Unknown error',
            })
          }
        }
      }

      if (failures.length > 0) {
        captureMessage('autopilot_run_completed_with_failures', {
          route: '/api/autopilot/run',
          requestId,
          isCron,
          dryRun: parsed.data.dryRun,
          usersProcessed,
          leadsProcessed,
          emailsAttempted,
          successfulSends,
          failureCount: failures.length,
        })
      }

      return ok(
        {
          mode: isCron ? 'cron' : 'user',
          usersProcessed,
          leadsProcessed,
          emailsAttempted,
          successfulSends,
          failureCount: failures.length,
          failures: failures.map((f) => ({
            userId: f.userId,
            leadId: f.leadId ?? null,
            code: f.code,
            message: f.message,
          })),
        },
        undefined,
        undefined,
        requestId
      )
    } catch (error) {
      captureException(error, { route: '/api/autopilot/run', requestId, isCron })
      return asHttpError(error, '/api/autopilot/run', undefined, undefined, requestId)
    }
  },
  {
    bodySchema: AutopilotRunSchema.partial(),
  }
)

