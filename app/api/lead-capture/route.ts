import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createCookieBridge, ok, fail, ErrorCode, HttpStatus } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { adminNotificationsEnabled, getLifecycleAdminEmails } from '@/lib/lifecycle/config'
import { renderAdminNotificationEmail } from '@/lib/email/internal'
import { sendEmailDeduped } from '@/lib/email/send-deduped'
import { getResendReplyToEmail } from '@/lib/email/routing'
import { getAppUrl } from '@/lib/app-url'
import crypto from 'crypto'

const LeadCaptureSchema = z.object({
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(128).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  role: z.string().trim().max(128).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  intent: z.enum(['demo', 'pricing_question', 'trial_help', 'general']).default('demo'),
  message: z.string().trim().max(1000).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  route: z.string().trim().min(1).max(512),
  referrer: z.string().trim().max(512).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  utm: z
    .object({
      source: z.string().trim().max(128).optional(),
      medium: z.string().trim().max(128).optional(),
      campaign: z.string().trim().max(128).optional(),
    })
    .optional(),
  deviceClass: z.enum(['mobile', 'desktop', 'unknown']).optional().default('unknown'),
  viewport: z
    .object({
      w: z.number().int().min(0).max(10000).optional(),
      h: z.number().int().min(0).max(10000).optional(),
    })
    .optional(),
})

function dayKeyUtc(ts = Date.now()): string {
  const d = new Date(ts)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function computeDedupeKey(args: { email: string; intent: string; route: string }): string {
  // Daily dedupe per (email,intent,route) to keep this endpoint abuse-resistant.
  // This is an opaque hash; no secrets.
  const normalized = `${args.email.trim().toLowerCase()}|${args.intent}|${args.route.trim()}|${dayKeyUtc()}`
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    const rid = requestId

    if (body === undefined) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Invalid lead capture payload', undefined, { status: 400 }, bridge, rid)
    }

    try {
      const supabase = createRouteClient(request, bridge)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const payload = body as z.infer<typeof LeadCaptureSchema>
      const dedupeKey = computeDedupeKey({ email: payload.email, intent: payload.intent, route: payload.route })
      const insert = {
        user_id: user?.id ?? null,
        email: payload.email.trim(),
        company: payload.company ?? null,
        role: payload.role ?? null,
        intent: payload.intent,
        message: payload.message ?? null,
        route: payload.route,
        referrer: payload.referrer ?? null,
        utm_source: payload.utm?.source ?? null,
        utm_medium: payload.utm?.medium ?? null,
        utm_campaign: payload.utm?.campaign ?? null,
        device_class: payload.deviceClass,
        viewport_w: payload.viewport?.w ?? null,
        viewport_h: payload.viewport?.h ?? null,
        dedupe_key: dedupeKey,
        meta: {},
      }

      const { error } = await supabase.from('lead_captures').insert(insert)
      if (error) {
        // Unique violation (dedupe): treat as success to be user-friendly.
        // PostgREST uses SQLSTATE 23505 for unique violations; surface may vary, so check both.
        const msg = (error as { message?: string; code?: string } | null)?.message ?? ''
        const code = (error as { code?: string } | null)?.code ?? ''
        const isUnique = code === '23505' || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')
        if (!isUnique) {
          return fail(ErrorCode.DATABASE_ERROR, 'Failed to save request', undefined, { status: 500 }, bridge, rid)
        }
      }

      // Optional: operator notification (best-effort, deduped). Never block user success.
      try {
        const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
        const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
        const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean(from)
        const admins = getLifecycleAdminEmails()
        if (hasServiceRole && adminNotificationsEnabled() && admins.length > 0 && hasResend) {
          const appUrl = getAppUrl()
          const email = renderAdminNotificationEmail({
            title: 'Lead capture',
            appUrl,
            ctaHref: `${appUrl}${payload.route}`,
            ctaLabel: 'Open route',
            lines: [
              `intent: ${payload.intent}`,
              `email: ${payload.email}`,
              payload.company ? `company: ${payload.company}` : '',
              payload.role ? `role: ${payload.role}` : '',
              payload.referrer ? `referrer: ${payload.referrer}` : '',
              payload.utm?.source ? `utm_source: ${payload.utm.source}` : '',
              payload.utm?.medium ? `utm_medium: ${payload.utm.medium}` : '',
              payload.utm?.campaign ? `utm_campaign: ${payload.utm.campaign}` : '',
              payload.message ? `message: ${payload.message}` : '(no message)',
            ].filter((l) => l.length > 0),
          })
          const adminClient = createSupabaseAdminClient({ schema: 'api' })
          await Promise.allSettled(
            admins.map((toEmail) =>
              sendEmailDeduped(adminClient, {
                dedupeKey: `admin:lead_capture:${dedupeKey}:${toEmail}`,
                userId: null,
                toEmail,
                fromEmail: from,
                replyTo: getResendReplyToEmail(),
                subject: email.subject,
                html: email.html,
                text: email.text,
                kind: 'internal',
                template: 'admin_lead_capture',
                tags: [
                  { name: 'kind', value: 'internal' },
                  { name: 'type', value: 'lead_capture' },
                ],
                meta: { intent: payload.intent, route: payload.route },
              })
            )
          )
        }
      } catch {
        // best-effort only
      }

      return ok({ saved: true }, { status: HttpStatus.CREATED }, bridge, rid)
    } catch (e) {
      return fail(
        ErrorCode.INTERNAL_ERROR,
        'Failed to submit request',
        e instanceof Error ? { message: e.message } : undefined,
        { status: 500 },
        bridge,
        rid
      )
    }
  },
  { bodySchema: LeadCaptureSchema }
)

