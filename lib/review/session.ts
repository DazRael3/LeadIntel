import type { NextRequest, NextResponse } from 'next/server'
import { signReviewToken, verifyReviewToken } from '@/lib/review/security'
import { REVIEW_MODE_COOKIE, REVIEW_SESSION_COOKIE, clearReviewSessionCookies } from '@/lib/review/cookies'

export type ReviewSession = {
  linkId: string
  exp: number
}

export function getReviewSessionFromRequest(request: NextRequest): ReviewSession | null {
  const raw = request.cookies.get(REVIEW_SESSION_COOKIE)?.value ?? ''
  if (!raw) return null
  const verified = verifyReviewToken(raw, 'review_session')
  if (!verified) return null
  return { linkId: verified.linkId, exp: verified.exp }
}

export function setReviewSessionCookies(args: {
  response: NextResponse
  linkId: string
  exp: number
}): void {
  const token = signReviewToken({ v: 1, aud: 'review_session', linkId: args.linkId, exp: args.exp })
  const maxAge = Math.max(0, args.exp - Math.floor(Date.now() / 1000))
  const secure = process.env.NODE_ENV === 'production'

  args.response.cookies.set(REVIEW_SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  })

  // Non-sensitive UI hint cookie for badges/banners.
  args.response.cookies.set(REVIEW_MODE_COOKIE, '1', {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
}

export { REVIEW_MODE_COOKIE, REVIEW_SESSION_COOKIE }
export { clearReviewSessionCookies }

