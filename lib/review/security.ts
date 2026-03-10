import crypto from 'crypto'

export type ReviewTokenAudience = 'review_link' | 'review_session'

export type ReviewTokenPayload = {
  v: 1
  aud: ReviewTokenAudience
  linkId: string
  exp: number // unix seconds
}

function hmac(secret: string, input: string): string {
  return crypto.createHmac('sha256', secret).update(input, 'utf8').digest('base64url')
}

function getSecret(): string {
  // Read directly from process.env so tests can set without module caching issues.
  return (process.env.REVIEW_SIGNING_SECRET ?? '').trim()
}

export function signReviewToken(payload: ReviewTokenPayload): string {
  const secret = getSecret()
  if (!secret) throw new Error('review_signing_secret_missing')
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = hmac(secret, body)
  return `${body}.${sig}`
}

export function verifyReviewToken(token: string, expectedAud: ReviewTokenAudience): ReviewTokenPayload | null {
  const secret = getSecret()
  if (!secret) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = hmac(secret, body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!crypto.timingSafeEqual(a, b)) return null
  try {
    const raw = Buffer.from(body, 'base64url').toString('utf8')
    const obj = JSON.parse(raw) as ReviewTokenPayload
    if (obj.v !== 1) return null
    if (obj.aud !== expectedAud) return null
    if (typeof obj.linkId !== 'string' || obj.linkId.trim() === '') return null
    if (typeof obj.exp !== 'number') return null
    if (Math.floor(Date.now() / 1000) > obj.exp) return null
    return obj
  } catch {
    return null
  }
}

