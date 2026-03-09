import crypto from 'crypto'

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex')
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const aa = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (aa.length !== bb.length) return false
  return crypto.timingSafeEqual(aa, bb)
}

export function randomApiKeySecret(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

