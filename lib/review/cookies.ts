import type { NextRequest, NextResponse } from 'next/server'

export const REVIEW_SESSION_COOKIE = 'li_review_session'
export const REVIEW_MODE_COOKIE = 'li_review_mode'

function toBase64(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const rem = padded.length % 4
  if (rem === 0) return padded
  if (rem === 2) return `${padded}==`
  if (rem === 3) return `${padded}=`
  return padded
}

function decodeBase64UrlToString(input: string): string | null {
  try {
    const normalized = toBase64(input)
    if (typeof atob === 'function') {
      const bin = atob(normalized)
      const bytes = Uint8Array.from(bin, (char) => char.charCodeAt(0))
      return new TextDecoder().decode(bytes)
    }
    return null
  } catch {
    return null
  }
}

function encodeBytesToBase64Url(bytes: Uint8Array): string | null {
  if (typeof btoa !== 'function') return null
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return mismatch === 0
}

type ReviewSessionPayload = {
  v: number
  aud: 'review_session'
  linkId: string
  exp: number
}

async function signBodyWithSecret(body: string, secret: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null
  const keyData = new TextEncoder().encode(secret)
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await globalThis.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return encodeBytesToBase64Url(new Uint8Array(signed))
}

export async function hasValidReviewSessionCookieEdge(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(REVIEW_SESSION_COOKIE)?.value ?? ''
  if (!token) return false

  const [body, signature] = token.split('.')
  if (!body || !signature) return false

  const secret = (process.env.REVIEW_SIGNING_SECRET ?? '').trim()
  if (!secret) return false

  const expectedSignature = await signBodyWithSecret(body, secret)
  if (!expectedSignature) return false
  if (!timingSafeEqualString(signature, expectedSignature)) return false

  const decoded = decodeBase64UrlToString(body)
  if (!decoded) return false

  try {
    const payload = JSON.parse(decoded) as ReviewSessionPayload
    if (payload.v !== 1 || payload.aud !== 'review_session') return false
    if (typeof payload.linkId !== 'string' || payload.linkId.trim().length === 0) return false
    if (typeof payload.exp !== 'number') return false
    return Math.floor(Date.now() / 1000) <= payload.exp
  } catch {
    return false
  }
}

export function clearReviewSessionCookies(response: NextResponse): void {
  const secure = process.env.NODE_ENV === 'production'
  response.cookies.set(REVIEW_SESSION_COOKIE, '', { path: '/', maxAge: 0, secure, sameSite: 'lax', httpOnly: true })
  response.cookies.set(REVIEW_MODE_COOKIE, '', { path: '/', maxAge: 0, secure, sameSite: 'lax', httpOnly: false })
}
