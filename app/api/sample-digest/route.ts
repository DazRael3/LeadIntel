import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { generateSampleDigest } from '@/lib/sampleDigest'
import { checkPublicRateLimit } from '@/lib/rateLimit'
import { sendEmailWithResend } from '@/lib/email/resend'
import { serverEnv } from '@/lib/env'
import { parseTarget } from '@/lib/onboarding/targets'
import { getResendReplyToEmail } from '@/lib/email/routing'
import { createDemoSessionHandoff, setDemoHandoffCookie } from '@/lib/demo/handoff'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  companyOrUrl: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .refine((v) => parseTarget(v) !== null, { message: 'Enter a company name or website, like Google or google.com.' }),
  email: z.string().trim().email().optional(),
  emailMe: z.boolean().optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const limited = await checkPublicRateLimit({
        request,
        route: '/api/sample-digest',
        limit: 10,
        window: '10 m',
        windowMsFallback: 10 * 60 * 1000,
      })
      if (!limited.ok) {
        return fail(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          'Too many requests. Please try again in a few minutes.',
          { reset: limited.reset },
          { headers: { 'X-RateLimit-Remaining': String(limited.remaining) } },
          bridge,
          requestId
        )
      }

      const parsed = body as z.infer<typeof BodySchema>
      const target = parseTarget(parsed.companyOrUrl)
      if (!target) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'Enter a company name or website, like Google or google.com.',
          undefined,
          { status: 400 },
          bridge,
          requestId
        )
      }

      const sample = generateSampleDigest(target.name)
      const handoff = await createDemoSessionHandoff({
        request,
        payload: {
          version: 1,
          capturedAt: new Date().toISOString(),
          companyName: target.name,
          companyDomain: target.domain,
          companyUrl: target.url,
          sample,
        },
      })

      const emailRequested = Boolean(parsed.emailMe) && typeof parsed.email === 'string' && parsed.email.length > 0
      let emailSent = false
      let emailReason: string | null = null

      if (emailRequested) {
        const resendKey = (process.env.RESEND_API_KEY ?? '').trim()
        if (!resendKey) {
          emailReason = 'Email sending is not enabled yet.'
        } else {
          const to = parsed.email as string
          const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim() || 'leadintel@dazrael.com'
          const subject = `Your LeadIntel sample digest — ${sample.company}`
          const lines = [
            `Sample lead score: ${sample.score}/100`,
            '',
            'Sample trigger signals:',
            ...sample.triggers.map((t) => `- ${t}`),
            '',
            'Why now:',
            sample.whyNow,
            '',
            'Outreach draft:',
            sample.outreach.subject ? `Subject: ${sample.outreach.subject}` : '',
            sample.outreach.body,
            '',
            sample.disclaimer,
          ].filter((l) => l.length > 0)

          const html = `<div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
            <h2 style="margin: 0 0 12px;">LeadIntel — Sample Daily Deal Digest</h2>
            <p style="margin: 0 0 8px;"><strong>Company:</strong> ${escapeHtml(sample.company)}</p>
            <p style="margin: 0 0 8px;"><strong>Sample lead score:</strong> ${sample.score}/100</p>
            <p style="margin: 12px 0 6px;"><strong>Sample trigger signals:</strong></p>
            <ul style="margin: 0 0 12px; padding-left: 18px;">
              ${sample.triggers.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
            </ul>
            <p style="margin: 12px 0 6px;"><strong>Why now:</strong></p>
            <p style="margin: 0 0 12px;">${escapeHtml(sample.whyNow)}</p>
            <p style="margin: 12px 0 6px;"><strong>Outreach draft (${escapeHtml(sample.outreach.channel)}):</strong></p>
            ${sample.outreach.subject ? `<p style="margin: 0 0 8px;"><strong>Subject:</strong> ${escapeHtml(sample.outreach.subject)}</p>` : ''}
            <pre style="white-space: pre-wrap; background: #0b1220; color: #d1d5db; padding: 12px; border-radius: 8px; border: 1px solid rgba(34,211,238,0.2);">${escapeHtml(sample.outreach.body)}</pre>
            <p style="margin: 12px 0 0; color: #6b7280; font-size: 12px;">${escapeHtml(sample.disclaimer)}</p>
          </div>`

          const send = await sendEmailWithResend({
            from,
            to,
            replyTo: getResendReplyToEmail(),
            subject,
            html,
            text: lines.join('\n'),
            tags: [{ name: 'kind', value: 'sample_digest' }],
          })

          if (send.ok) {
            emailSent = true
          } else {
            emailReason = send.errorMessage || 'Email send failed.'
          }
        }
      }

      const response = ok(
        {
          sample,
          handoff: {
            stored: Boolean(handoff),
          },
          email: {
            requested: emailRequested,
            sent: emailSent,
            ...(emailReason ? { reason: emailReason } : {}),
          },
        },
        undefined,
        bridge,
        requestId
      )
      if (handoff) {
        setDemoHandoffCookie({ response, token: handoff.token })
      }
      return response
    } catch (err) {
      return asHttpError(err, '/api/sample-digest', undefined, bridge, requestId)
    }
  },
  { bodySchema: BodySchema, bypassRateLimit: true }
)

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

