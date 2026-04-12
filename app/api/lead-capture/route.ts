import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createCookieBridge, ok, fail, ErrorCode, HttpStatus } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { adminNotificationsEnabled, getLifecycleAdminEmails } from '@/lib/lifecycle/config'
import { renderAdminNotificationEmail, renderLeadCaptureConfirmationEmail, type LeadDemoPlan } from '@/lib/email/internal'
import { sendEmailDeduped } from '@/lib/email/send-deduped'
import { sendEmailWithResend } from '@/lib/email/resend'
import { getResendReplyToEmail } from '@/lib/email/routing'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { getAppUrl } from '@/lib/app-url'
import OpenAI from 'openai'
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

function getLeadCaptureAdminRecipients(): string[] {
  const normalized = new Set<string>()
  const add = (value: string | null | undefined): void => {
    if (typeof value !== 'string') return
    const email = value.trim().toLowerCase()
    if (!email || !email.includes('@') || !email.includes('.')) return
    normalized.add(email)
  }
  add(SUPPORT_EMAIL)
  getLifecycleAdminEmails().forEach((email) => add(email))
  return Array.from(normalized)
}

function buildFallbackDemoPlan(args: {
  intent: 'demo' | 'pricing_question' | 'trial_help' | 'general'
  company?: string
  role?: string
  message?: string
}): LeadDemoPlan {
  const companyLabel = args.company ? `${args.company}` : 'your team'
  const roleLabel = args.role ? `for ${args.role}` : 'for your workflow'
  const summary =
    args.intent === 'demo'
      ? `We prepared a practical LeadIntel walkthrough for ${companyLabel} ${roleLabel}.`
      : `We prepared a focused response plan for ${companyLabel} ${roleLabel}.`
  const steps = [
    `Map your current outbound process and identify one repetitive bottleneck.`,
    `Configure a short LeadIntel workflow to surface high-signal targets daily.`,
    `Run one guided cycle and capture measurable lift in response speed or quality.`,
  ]
  if (args.message && args.message.trim()) {
    steps[1] = `Align the workflow to your note: "${args.message.trim().slice(0, 120)}".`
  }
  return {
    summary,
    steps,
    timeToValue: '1-2 business days',
    aiGenerated: false,
  }
}

function normalizePlanFromText(text: string): LeadDemoPlan {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const summary = lines[0] ?? 'We prepared a practical LeadIntel walkthrough tailored to your request.'
  const stepLines = lines.slice(1).map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
  const steps = stepLines.filter((line) => line.length > 0).slice(0, 3)
  while (steps.length < 3) {
    steps.push('Review your workflow goals and confirm the next high-value step.')
  }
  const lastLine = lines[lines.length - 1] ?? ''
  const timeToValueMatch = lastLine.match(/time-to-value[:\s]+(.+)/i)
  const timeToValue = timeToValueMatch?.[1]?.trim() || '1-2 business days'
  return {
    summary,
    steps,
    timeToValue,
    aiGenerated: true,
  }
}

function getOpenAiApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  return typeof key === 'string' ? key.trim() : ''
}

function canGenerateAiDemoPlan(): boolean {
  return getOpenAiApiKey().startsWith('sk-')
}

async function generateLeadDemoPlan(args: {
  intent: 'demo' | 'pricing_question' | 'trial_help' | 'general'
  company?: string
  role?: string
  message?: string
  route: string
}): Promise<LeadDemoPlan> {
  const fallback = buildFallbackDemoPlan(args)
  if (!canGenerateAiDemoPlan()) return fallback
  try {
    const apiKey = getOpenAiApiKey()
    if (!apiKey) return fallback
    const client = new OpenAI({ apiKey })
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content:
            'You produce short B2B demo onboarding outlines. Return plain text with 5 lines only: line1 summary, line2 step1, line3 step2, line4 step3, line5 "Time-to-value: <duration>".',
        },
        {
          role: 'user',
          content: [
            `Intent: ${args.intent}`,
            `Company: ${args.company ?? 'Unknown'}`,
            `Role: ${args.role ?? 'Unknown'}`,
            `Route: ${args.route}`,
            `Message: ${(args.message ?? '').slice(0, 300) || 'None'}`,
            'Keep each step actionable and realistic for a first implementation pass.',
          ].join('\n'),
        },
      ],
    })
    const content = response.choices[0]?.message?.content
    if (!content || !content.trim()) return fallback
    return normalizePlanFromText(content)
  } catch {
    return fallback
  }
}

async function sendLeadCaptureFollowUp(args: {
  email: string
  dedupeKey: string
  requestId: string
  recipientName?: string
  company?: string
  role?: string
  intent: 'demo' | 'pricing_question' | 'trial_help' | 'general'
  route: string
  message?: string
}): Promise<{ sent: boolean; reason?: string; demoPlanSource?: 'ai' | 'fallback' }> {
  const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
  const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean(from)
  if (!hasResend) return { sent: false, reason: 'email_not_configured' }

  try {
    const appUrl = getAppUrl()
    const demoPlan =
      args.intent === 'demo'
        ? await generateLeadDemoPlan({
            intent: args.intent,
            company: args.company,
            role: args.role,
            message: args.message,
            route: args.route,
          })
        : null
    const email = renderLeadCaptureConfirmationEmail({
      recipientName: args.recipientName,
      appUrl,
      intent: args.intent,
      route: args.route,
      company: args.company,
      requestId: args.requestId,
      variationSeed: args.dedupeKey,
      demoPlan: demoPlan ?? undefined,
    })
    const direct = await sendEmailWithResend({
      from,
      to: args.email,
      replyTo: getResendReplyToEmail(),
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [
        { name: 'kind', value: 'lead_capture' },
        { name: 'type', value: args.intent },
        { name: 'demo_plan', value: demoPlan?.aiGenerated ? 'ai' : 'fallback' },
      ],
    })
    if (!direct.ok) {
      return {
        sent: false,
        reason: 'send_failed',
        demoPlanSource: demoPlan ? (demoPlan.aiGenerated ? 'ai' : 'fallback') : undefined,
      }
    }
    return {
      sent: true,
      demoPlanSource: demoPlan ? (demoPlan.aiGenerated ? 'ai' : 'fallback') : undefined,
    }
  } catch {
    return { sent: false, reason: 'send_failed' }
  }
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

      const followUp = await sendLeadCaptureFollowUp({
        email: payload.email.trim(),
        dedupeKey,
        requestId: rid,
        recipientName: undefined,
        company: payload.company,
        role: payload.role,
        intent: payload.intent,
        route: payload.route,
        message: payload.message,
      })

      // Optional: operator notification (best-effort, deduped). Never block user success.
      try {
        const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
        const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
        const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean(from)
        const admins = getLeadCaptureAdminRecipients()
        if (hasServiceRole && adminNotificationsEnabled() && admins.length > 0 && hasResend) {
          const appUrl = getAppUrl()
          const email = renderAdminNotificationEmail({
            title: 'Lead capture',
            appUrl,
            requestId: rid,
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

      return ok(
        {
          saved: true,
          followUp: {
            sent: followUp.sent,
            ...(followUp.reason ? { reason: followUp.reason } : {}),
            ...(followUp.demoPlanSource ? { demoPlanSource: followUp.demoPlanSource } : {}),
          },
        },
        { status: HttpStatus.CREATED },
        bridge,
        rid
      )
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

