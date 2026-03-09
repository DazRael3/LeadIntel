import crypto from 'crypto'

export type EmbedTokenPayload = {
  v: 1
  workspaceId: string
  kind: 'account_summary' | 'shortlist' | 'readiness'
  accountId?: string
  exp: number // unix seconds
}

function hmac(secret: string, input: string): string {
  return crypto.createHmac('sha256', secret).update(input, 'utf8').digest('base64url')
}

export function signEmbedToken(payload: EmbedTokenPayload): string {
  // Read directly from process.env so tests can set without module caching issues.
  const secret = (process.env.EMBED_SIGNING_SECRET ?? '').trim()
  if (!secret) throw new Error('embed_signing_secret_missing')
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = hmac(secret, body)
  return `${body}.${sig}`
}

export function verifyEmbedToken(token: string): EmbedTokenPayload | null {
  // Read directly from process.env so tests can set without module caching issues.
  const secret = (process.env.EMBED_SIGNING_SECRET ?? '').trim()
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
    const obj = JSON.parse(raw) as EmbedTokenPayload
    if (obj.v !== 1) return null
    if (typeof obj.workspaceId !== 'string' || typeof obj.kind !== 'string' || typeof obj.exp !== 'number') return null
    if (Math.floor(Date.now() / 1000) > obj.exp) return null
    return obj
  } catch {
    return null
  }
}

