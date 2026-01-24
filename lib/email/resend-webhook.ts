import crypto from 'crypto'

export type ResendWebhookHeaders = Record<string, string | undefined>

export type VerifyResendWebhookArgs = {
  secret: string
  rawBody: Buffer
  headers: ResendWebhookHeaders
  nowMs?: number
  toleranceSeconds?: number
}

/**
 * Resend webhooks are commonly backed by Svix-style signing headers:
 * - svix-id
 * - svix-timestamp
 * - svix-signature (one or more "v1,<base64>" entries)
 *
 * This verifier supports:
 * - `svix-*` headers (preferred)
 * - `x-resend-signature` as a simple HMAC-SHA256 hex digest of the raw body (fallback)
 */
export function verifyResendWebhookSignature(args: VerifyResendWebhookArgs): boolean {
  const tolerance = args.toleranceSeconds ?? 5 * 60
  const now = args.nowMs ?? Date.now()

  const svixId = header(args.headers, 'svix-id')
  const svixTs = header(args.headers, 'svix-timestamp')
  const svixSig = header(args.headers, 'svix-signature')

  if (svixId && svixTs && svixSig) {
    const tsNum = Number(svixTs)
    if (!Number.isFinite(tsNum)) return false
    const ageSeconds = Math.abs(now - tsNum * 1000) / 1000
    if (ageSeconds > tolerance) return false

    const toSign = `${svixId}.${svixTs}.${args.rawBody.toString('utf-8')}`
    const expected = crypto.createHmac('sha256', args.secret).update(toSign).digest('base64')

    const candidates = parseSvixSignatures(svixSig)
    return candidates.some((c) => timingSafeEqualBase64(c, expected))
  }

  // Fallback: simple HMAC of raw body (hex)
  const legacy = header(args.headers, 'x-resend-signature')
  if (!legacy) return false
  const expectedHex = crypto.createHmac('sha256', args.secret).update(args.rawBody).digest('hex')
  return timingSafeEqualHex(legacy, expectedHex)
}

function header(headers: ResendWebhookHeaders, name: string): string | undefined {
  const direct = headers[name]
  if (direct) return direct
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v
  }
  return undefined
}

function parseSvixSignatures(headerValue: string): string[] {
  // Example formats we handle:
  // - "v1,BASE64"
  // - "v1,BASE64 v1,BASE64_2"
  // - "v1,BASE64,v2,OTHER" (we only keep v1)
  const tokens = headerValue.split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (const t of tokens) {
    const parts = t.split(',')
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const ver = parts[i]?.trim()
      const sig = parts[i + 1]?.trim()
      if (ver === 'v1' && sig) out.push(sig)
    }
  }
  return out
}

function timingSafeEqualBase64(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, 'base64')
    const bb = Buffer.from(b, 'base64')
    if (ab.length !== bb.length) return false
    return crypto.timingSafeEqual(ab, bb)
  } catch {
    return false
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, 'hex')
    const bb = Buffer.from(b, 'hex')
    if (ab.length !== bb.length) return false
    return crypto.timingSafeEqual(ab, bb)
  } catch {
    return false
  }
}

