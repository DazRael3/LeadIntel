import crypto from 'crypto'

export type CronTokenContext = {
  method: string
  pathname: string
}

/**
 * Derive a deterministic cron token for a specific route+method.
 *
 * Token format:
 * - base64url(HMAC_SHA256(CRON_SIGNING_SECRET, `v1:${METHOD}:${PATHNAME}`))
 *
 * This is intended to be precomputed (offline) and injected into Vercel Cron job URLs
 * as a `cron_token` query parameter.
 */
export function computeCronToken(args: { signingSecret: string; ctx: CronTokenContext }): string {
  const msg = `v1:${args.ctx.method.toUpperCase()}:${args.ctx.pathname}`
  return crypto.createHmac('sha256', args.signingSecret).update(msg).digest('base64url')
}

export function verifyCronToken(args: {
  signingSecret: string
  providedToken: string
  ctx: CronTokenContext
}): boolean {
  const expected = computeCronToken({ signingSecret: args.signingSecret, ctx: args.ctx })
  return timingSafeEqualAscii(args.providedToken, expected)
}

export function timingSafeEqualAscii(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  // Use constant-time compare; ascii-only safe for our tokens.
  let out = 0
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return out === 0
}

