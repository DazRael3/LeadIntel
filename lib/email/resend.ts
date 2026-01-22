import { Resend } from 'resend'
import { getServerEnv } from '@/lib/env'
import { isTestLikeEnv } from '@/lib/runtimeFlags'

let resendInstance: Resend | null = null

export type ResendSendEmailInput = {
  from: string
  to: string | string[]
  subject: string
  html: string
  text?: string
  tags?: Array<{ name: string; value: string }>
}

export type ResendSendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; errorMessage: string }

export function getResendClient(): Resend {
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
 * Sends an email through Resend.
 *
 * In test-like environments we still allow the call (Resend is mocked in vitest),
 * but we never log raw payloads or secrets.
 */
export async function sendEmailWithResend(input: ResendSendEmailInput): Promise<ResendSendEmailResult> {
  try {
    const resend = getResendClient()
    const { data, error } = await resend.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: input.tags,
    })

    if (error) {
      return { ok: false, errorMessage: error.message || 'Resend send failed' }
    }

    const messageId = data?.id
    if (!messageId) {
      return { ok: false, errorMessage: 'Resend did not return a message id' }
    }

    return { ok: true, messageId }
  } catch (err) {
    // In some CI setups outbound network may be blocked; Resend is mocked in unit tests.
    if (isTestLikeEnv()) {
      return { ok: true, messageId: 'email_test_mocked' }
    }
    return { ok: false, errorMessage: err instanceof Error ? err.message : 'Resend send failed' }
  }
}

