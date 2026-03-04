import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode } from '@/lib/api/http'
import { sendEmailWithResend } from '@/lib/email/resend'
import { serverEnv } from '@/lib/env'
import { SUPPORT_EMAIL } from '@/lib/config/contact'

const BodySchema = z.object({
  email: z.string().trim().email(),
  company: z.string().trim().min(1).max(80),
  digestLines: z.array(z.string().max(300)).min(3).max(50),
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const POST = withApiGuard(
  async (_request: NextRequest, { body, requestId }) => {
    try {
      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'Invalid email request',
          parsed.error.flatten(),
          { status: 422 },
          undefined,
          requestId
        )
      }

      const from = (serverEnv.RESEND_FROM_EMAIL || 'leadintel@dazrael.com').trim()
      if (!from) {
        return ok({ sent: false, reason: 'from_email_not_configured' }, undefined, undefined, requestId)
      }

      const subject = `Your LeadIntel sample digest for ${parsed.data.company}`
      const text = parsed.data.digestLines.join('\n')
      const html = `
        <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap;">
${escapeHtml(text)}
        </div>
        <p style="margin-top:16px;font-family: ui-sans-serif, system-ui;">
          Want this daily for your accounts? Create your LeadIntel workspace and enable the Daily Digest.
        </p>
        <p style="font-family: ui-sans-serif, system-ui;">
          <a href="https://dazrael.com/signup?redirect=/dashboard">Start free</a>
        </p>
      `

      const result = await sendEmailWithResend({
        from,
        to: parsed.data.email,
        replyTo: SUPPORT_EMAIL,
        subject,
        html,
        text,
        tags: [
          { name: 'source', value: 'landing_demo' },
          { name: 'company', value: parsed.data.company.slice(0, 50) },
        ],
      })

      if (!result.ok) {
        return ok({ sent: false, reason: 'send_failed' }, undefined, undefined, requestId)
      }

      return ok({ sent: true }, undefined, undefined, requestId)
    } catch (error) {
      return asHttpError(error, '/api/demo/email', undefined, undefined, requestId)
    }
  },
  { bodySchema: BodySchema }
)

