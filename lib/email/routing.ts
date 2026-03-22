import { serverEnv } from '@/lib/env'
import { SUPPORT_EMAIL } from '@/lib/config/contact'

export function getResendReplyToEmail(): string {
  const v = (serverEnv.RESEND_REPLY_TO_EMAIL ?? '').trim()
  if (v) return v
  return SUPPORT_EMAIL
}

