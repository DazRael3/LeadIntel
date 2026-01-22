import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { sendEmailWithResend } from '@/lib/email/resend'
import { insertEmailLog } from '@/lib/email/email-logs'
import { renderSimplePitchEmailHtml } from '@/lib/email/templates'
import { captureBreadcrumb, captureException, captureMessage } from '@/lib/observability/sentry'
import { recordCounter } from '@/lib/observability/metrics'

/**
 * Auto-Send Pitch API
 * Allows Pro users to send AI-generated pitches directly via email
 */

const SendPitchExtendedSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format'),
  recipientEmail: z.string().email('Invalid recipient email'),
  recipientName: z.string().optional(),
  companyName: z.string().optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const { leadId, recipientEmail, recipientName, companyName } = body as z.infer<typeof SendPitchExtendedSchema>

      const supabase = createRouteClient(request, bridge)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()

      if (userData?.subscription_tier !== 'pro') {
        return fail(
          ErrorCode.FORBIDDEN,
          'Pro subscription required to send emails',
          undefined,
          undefined,
          bridge,
          requestId
        )
      }

      // Fetch lead data
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, company_name, ai_personalized_pitch')
        .eq('id', leadId)
        .single()

      if (leadError || !lead) {
        captureMessage('send_pitch_lead_not_found', { route: '/api/send-pitch', requestId, userId, leadId })
        return fail(ErrorCode.NOT_FOUND, 'Lead not found', undefined, undefined, bridge, requestId)
      }

      // Sender identity (best-effort)
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('sender_name, from_email')
        .eq('user_id', user.id)
        .maybeSingle()

      const senderName = userSettings?.sender_name || 'LeadIntel Team'
      const senderEmail = userSettings?.from_email || process.env.RESEND_FROM_EMAIL || 'noreply@leadintel.com'
      const companyNameFinal = companyName || lead.company_name || 'your company'

      const subject = `Quick intelligence on ${companyNameFinal}`
      const pitchText = lead.ai_personalized_pitch || `I put together a short intelligence snapshot on ${companyNameFinal}.`
      const html = renderSimplePitchEmailHtml({
        brandName: 'LeadIntel',
        recipientName,
        senderName,
        pitchText,
        footerText: 'This email was sent via LeadIntel. To manage preferences, visit your dashboard.',
      })
      const text = `Hi ${recipientName || 'there'},\n\n${pitchText}\n\nBest regards,\n${senderName}\nLeadIntel Autonomous Revenue Agent`

      const sendResult = await sendEmailWithResend({
        from: `${senderName} <${senderEmail}>`,
        to: recipientEmail,
        subject,
        html,
        text,
        tags: [{ name: 'kind', value: 'manual' }],
      })

      if (!sendResult.ok) {
        recordCounter('send_pitch.error', 1)
        captureMessage('send_pitch_resend_failed', {
          route: '/api/send-pitch',
          requestId,
          userId,
          leadId,
          provider: 'resend',
        })
        await insertEmailLog(supabase, {
          userId: user.id,
          leadId,
          toEmail: recipientEmail,
          fromEmail: senderEmail,
          subject,
          provider: 'resend',
          status: 'failed',
          error: sendResult.errorMessage,
          resendMessageId: null,
          sequenceStep: null,
          kind: 'manual',
        })
        return fail(ErrorCode.EXTERNAL_API_ERROR, 'Failed to send email', undefined, undefined, bridge, requestId)
      }

      recordCounter('send_pitch.success', 1)
      captureBreadcrumb({
        category: 'email',
        level: 'info',
        message: 'send_pitch_sent',
        data: { route: '/api/send-pitch', requestId, userId, leadId, provider: 'resend' },
      })

      await insertEmailLog(supabase, {
        userId: user.id,
        leadId,
        toEmail: recipientEmail,
        fromEmail: senderEmail,
        subject,
        provider: 'resend',
        status: 'sent',
        error: null,
        resendMessageId: sendResult.messageId,
        sequenceStep: null,
        kind: 'manual',
      })

      return ok({ message: 'Email sent successfully', emailId: sendResult.messageId }, undefined, bridge, requestId)
    } catch (error) {
      recordCounter('send_pitch.error', 1)
      captureException(error, { route: '/api/send-pitch', requestId, userId, provider: 'resend' })
      return asHttpError(error, '/api/send-pitch', userId, bridge, requestId)
    }
  },
  {
    bodySchema: SendPitchExtendedSchema,
  }
)
