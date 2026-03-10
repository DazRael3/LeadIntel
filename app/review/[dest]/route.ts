import { NextRequest, NextResponse } from 'next/server'
import { verifyReviewToken } from '@/lib/review/security'
import { setReviewSessionCookies } from '@/lib/review/session'
import { createRouteClient } from '@/lib/supabase/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { ensureReviewDemoSetup } from '@/lib/review/demo'
import { logAudit } from '@/lib/audit/log'
import { isE2E } from '@/lib/runtimeFlags'

export const dynamic = 'force-dynamic'

const DESTINATIONS: Record<string, string> = {
  dashboard: '/dashboard',
  account: '/dashboard/portfolio',
  reports: '/reports',
  pricing: '/pricing',
  settings: '/settings/platform',
  team: '/settings/team',
  admin: '/settings/audit',
  upgrade: '/pricing',
}

type ReviewLinkRow = {
  id: string
  source_workspace_id: string
  expires_at: string
  revoked_at: string | null
  use_count: number
}

function safeDest(dest: string): { key: string; path: string } | null {
  const key = dest.trim().toLowerCase()
  const path = DESTINATIONS[key]
  if (!path) return null
  return { key, path }
}

function clearSupabaseAuthCookies(response: NextResponse): void {
  // Matches the cookie names cleared in `lib/supabase/proxy.ts`.
  const cookieNames = ['sb-refresh-token', 'sb-access-token', 'sb-provider-token', 'sb-provider-refresh-token']
  for (const name of cookieNames) {
    response.cookies.set(name, '', { maxAge: 0, path: '/' })
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ dest: string }> }) {
  const params = await ctx.params
  const dest = safeDest(params.dest ?? '')
  if (!dest) return NextResponse.json({ ok: false, error: { message: 'Not found' } }, { status: 404 })

  const token = request.nextUrl.searchParams.get('token') ?? ''
  const verified = token ? verifyReviewToken(token, 'review_link') : null
  if (!verified) return NextResponse.json({ ok: false, error: { message: 'Invalid or expired token' } }, { status: 404 })

  // Playwright/E2E runs use a fake Supabase client; simulate auth cookies only.
  if (isE2E()) {
    const exp = verified.exp
    const targetUrl = new URL(dest.path, request.nextUrl.origin)
    const response = NextResponse.redirect(targetUrl)
    response.cookies.set('li_e2e_auth', '1', { path: '/', maxAge: Math.max(0, exp - Math.floor(Date.now() / 1000)) })
    response.cookies.set('li_e2e_plan', 'team', { path: '/', maxAge: Math.max(0, exp - Math.floor(Date.now() / 1000)) })
    response.cookies.set('li_e2e_uid', 'e2e-review-user', { path: '/', maxAge: Math.max(0, exp - Math.floor(Date.now() / 1000)) })
    response.cookies.set('li_e2e_email', 'reviewer@example.com', { path: '/', maxAge: Math.max(0, exp - Math.floor(Date.now() / 1000)) })
    setReviewSessionCookies({ response, linkId: verified.linkId, exp })
    return response
  }

  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data: link } = await admin
    .schema('api')
    .from('review_links')
    .select('id, source_workspace_id, expires_at, revoked_at, use_count')
    .eq('id', verified.linkId)
    .maybeSingle()

  const row = (link ?? null) as unknown as ReviewLinkRow | null
  if (!row || row.revoked_at) return NextResponse.json({ ok: false, error: { message: 'Link revoked' } }, { status: 404 })

  const expiresAtMs = Date.parse(row.expires_at)
  if (!Number.isFinite(expiresAtMs) || Date.now() >= expiresAtMs) {
    return NextResponse.json({ ok: false, error: { message: 'Link expired' } }, { status: 404 })
  }

  const exp = Math.min(verified.exp, Math.floor(expiresAtMs / 1000))
  const targetUrl = new URL(dest.path, request.nextUrl.origin)
  const response = NextResponse.redirect(targetUrl)

  // Ensure the seeded demo workspace (fake data only) exists.
  const secretReady = Boolean((process.env.REVIEW_SIGNING_SECRET ?? '').trim())
  const demoEmailReady = Boolean((process.env.REVIEW_DEMO_EMAIL ?? '').trim())
  const demoPassReady = Boolean((process.env.REVIEW_DEMO_PASSWORD ?? '').trim())
  if (!secretReady || !demoEmailReady || !demoPassReady) {
    clearSupabaseAuthCookies(response)
    return NextResponse.json({ ok: false, error: { message: 'Review mode not configured' } }, { status: 424 })
  }

  let demo: Awaited<ReturnType<typeof ensureReviewDemoSetup>>
  try {
    demo = await ensureReviewDemoSetup()
  } catch {
    clearSupabaseAuthCookies(response)
    return NextResponse.json({ ok: false, error: { message: 'Review mode not configured' } }, { status: 424 })
  }

  // Set Supabase auth cookies by signing in the shared demo user server-side.
  const supabase = createRouteClient(request, response)
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: demo.demoEmail,
    password: (process.env.REVIEW_DEMO_PASSWORD ?? '').trim(),
  })
  if (signInError) {
    // Fail closed: do not leave a partial authenticated state.
    clearSupabaseAuthCookies(response)
    return NextResponse.json({ ok: false, error: { message: 'Review mode not configured' } }, { status: 424 })
  }

  // Mark the session as Review Mode (expires automatically).
  setReviewSessionCookies({ response, linkId: verified.linkId, exp })

  // Best-effort usage accounting + audit log (revocable + attributable).
  const nowIso = new Date().toISOString()
  await admin
    .schema('api')
    .from('review_links')
    .update({ last_used_at: nowIso, use_count: Math.max(0, Math.floor(row.use_count ?? 0)) + 1 })
    .eq('id', row.id)
    .catch(() => undefined)

  await logAudit({
    supabase: admin,
    workspaceId: row.source_workspace_id,
    actorUserId: demo.demoUserId,
    action: 'review_link.used',
    targetType: 'review_link',
    targetId: row.id,
    meta: { dest: dest.key },
    request,
  })

  return response
}

