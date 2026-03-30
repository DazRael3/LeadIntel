import { cookies } from 'next/headers'
import { REVIEW_SESSION_COOKIE } from '@/lib/review/session'
import { verifyReviewToken } from '@/lib/review/security'

export async function isReviewMode(): Promise<boolean> {
  const store = await cookies()
  const token = store.get(REVIEW_SESSION_COOKIE)?.value ?? ''
  if (!token) return false
  return Boolean(verifyReviewToken(token, 'review_session'))
}

