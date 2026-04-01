import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqualAscii } from '@/lib/api/cron-auth'

export const ADMIN_SESSION_COOKIE = 'li_admin_session'
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8 // 8h

type AdminSessionPayload = {
  v: 1
  aud: 'admin_session'
  exp: number
}

function hmac(secret: string, input: string): string {
  return crypto.createHmac('sha256', secret).update(input, 'utf8').digest('base64url')
}

function getAdminSessionSecret(): string {
  // Prefer a dedicated session secret; fall back to ADMIN_TOKEN for compatibility.
  const explicit = (process.env.ADMIN_SESSION_SECRET ?? '').trim()
  if (explicit) return explicit
  return (process.env.ADMIN_TOKEN ?? '').trim()
}

function signAdminSessionToken(payload: AdminSessionPayload): string {
  const secret = getAdminSessionSecret()
  if (!secret) throw new Error('admin_session_secret_missing')
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = hmac(secret, body)
  return `${body}.${sig}`
}

export function isValidAdminSessionToken(token: string | null | undefined): boolean {
  const raw = (token ?? '').trim()
  const secret = getAdminSessionSecret()
  if (!raw || !secret) return false

  const [body, sig] = raw.split('.')
  if (!body || !sig) return false

  const expected = hmac(secret, body)
  if (!timingSafeEqualAscii(sig, expected)) return false

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AdminSessionPayload
    if (parsed.v !== 1) return false
    if (parsed.aud !== 'admin_session') return false
    if (typeof parsed.exp !== 'number') return false
    return Math.floor(Date.now() / 1000) <= parsed.exp
  } catch {
    return false
  }
}

export function setAdminSessionCookie(response: NextResponse, args?: { ttlSeconds?: number }): void {
  const ttl = Math.max(60, Math.floor(args?.ttlSeconds ?? ADMIN_SESSION_TTL_SECONDS))
  const exp = Math.floor(Date.now() / 1000) + ttl
  const token = signAdminSessionToken({ v: 1, aud: 'admin_session', exp })
  const secure = process.env.NODE_ENV === 'production'
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: ttl,
  })
}

export function clearAdminSessionCookie(response: NextResponse): void {
  const secure = process.env.NODE_ENV === 'production'
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

export function hasAdminSessionFromRequest(request: NextRequest): boolean {
  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? ''
  return isValidAdminSessionToken(cookie)
}

export async function requireAdminSessionOrNotFound(): Promise<void> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? ''
  if (!isValidAdminSessionToken(token)) {
    const { notFound } = await import('next/navigation')
    notFound()
  }
}
