import { cookies } from 'next/headers'
import { REVIEW_SESSION_COOKIE } from '@/lib/review/session'

export async function isReviewMode(): Promise<boolean> {
  const store = await cookies()
  return Boolean(store.get(REVIEW_SESSION_COOKIE)?.value)
}

