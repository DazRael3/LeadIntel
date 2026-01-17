import { NextRequest } from 'next/server'
import { Resend } from 'resend'
import { createRouteClient } from '@/lib/supabase/route'
import { getServerEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { z } from 'zod'

// Lazy initialization of Resend client (only created at runtime, not during build)
let resendInstance: Resend | null = null

function getResendClient(): Resend {
  if (!resendInstance) {
    const env = getServerEnv()
    if (!env.RESEND_API_KEY) {
      throw new Error('Configuration Error: Missing API Key - RESEND_API_KEY')
    }
    resendInstance = new Resend(env.RESEND_API_KEY)
  }
  return resendInstance
}

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

export async function POST(request: NextRequest) {
  const bridge = createCookieBridge()
  
  try {
    // Validate request body
    let body
    try {
      body = await validateBody(request, SendPitchExtendedSchema)
    } catch (error) {
      return validationError(error, bridge)
    }

    const { leadId, recipientEmail, recipientName, companyName } = body

    // Check if user is Pro
    const supabase = createRouteClient(request, bridge)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
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
        bridge
      )
    }

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return fail(ErrorCode.NOT_FOUND, 'Lead not found', undefined, undefined, bridge)
    }

    // Get user settings for personalized sender info
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const senderName = userSettings?.sender_name || 'LeadIntel Team'
    const senderEmail = process.env.RESEND_FROM_EMAIL || 'noreply@leadintel.com'
    const companyName_final = companyName || lead.company_name

    // Send email using Resend
    const resend = getResendClient()
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: recipientEmail,
      subject: `Quick intelligence on ${companyName_final}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Lead Intelligence</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">LeadIntel</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">AI-Powered Lead Intelligence</p>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin: 0 0 20px 0;">
                Hi ${recipientName || 'there'},
              </p>
              <div style="background: white; padding: 20px; border-left: 4px solid #06b6d4; margin: 20px 0; border-radius: 4px;">
                ${lead.ai_personalized_pitch.split('\n').map((para: string) => `<p style="margin: 0 0 15px 0;">${para}</p>`).join('')}
              </div>
              <p style="font-size: 14px; color: #6b7280; margin: 20px 0 0 0;">
                Best regards,<br>
                <strong>${senderName}</strong><br>
                LeadIntel Autonomous Revenue Agent
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                This email was sent via LeadIntel. To manage your preferences, visit your dashboard.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${recipientName || 'there'},

${lead.ai_personalized_pitch}

Best regards,
${senderName}
LeadIntel Autonomous Revenue Agent
      `.trim(),
    })

    if (emailError) {
      return fail(
        ErrorCode.EXTERNAL_API_ERROR,
        'Failed to send email',
        undefined,
        undefined,
        bridge
      )
    }

    // Log the email send event
    try {
      await supabase
        .from('email_logs')
        .insert({
          user_id: user.id,
          lead_id: leadId,
          recipient_email: recipientEmail,
          sent_at: new Date().toISOString(),
          status: 'sent',
          resend_id: emailData?.id,
        })
    } catch (logError) {
      // Log error but don't fail the request
      console.error('Error logging email:', logError)
    }

    return ok({
      message: 'Email sent successfully',
      emailId: emailData?.id,
    }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/send-pitch', undefined, bridge)
  }
}
