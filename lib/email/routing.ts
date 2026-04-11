import { SUPPORT_EMAIL } from '@/lib/config/contact'

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function getResendReplyToEmail(): string {
  const v = (process.env.RESEND_REPLY_TO_EMAIL ?? '').trim()
  if (v && isLikelyEmail(v)) return v
  return SUPPORT_EMAIL
}

