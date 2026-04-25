import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { makeNameCompanyKey } from '@/lib/company-key'
import { ensurePersonalWorkspace, getCurrentWorkspace } from '@/lib/team/workspace'

export const DEMO_HANDOFF_COOKIE = 'li_demo_handoff'
export const DEMO_HANDOFF_TTL_SECONDS = 60 * 60

const SampleDigestSchema = z.object({
  company: z.string().trim().min(1).max(200),
  score: z.number().int().min(0).max(100),
  triggers: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
  whyNow: z.string().trim().min(1).max(4000),
  outreach: z.object({
    channel: z.enum(['email', 'linkedin']),
    subject: z.string().trim().max(300).optional(),
    body: z.string().trim().min(1).max(10000),
  }),
  disclaimer: z.string().trim().min(1).max(500),
})

const DemoSessionPayloadSchema = z.object({
  version: z.literal(1),
  capturedAt: z.string().datetime(),
  companyName: z.string().trim().min(1).max(200),
  companyDomain: z.string().trim().min(1).max(200).nullable(),
  companyUrl: z.string().trim().url().max(500).nullable(),
  sample: SampleDigestSchema,
})

type DemoSessionPayload = z.infer<typeof DemoSessionPayloadSchema>

type DemoSessionRow = {
  id: string
  payload: unknown
  expires_at: string
  consumed_at: string | null
  claimed_user_id: string | null
  claimed_lead_id: string | null
}

type ClaimedLeadRow = { id: string }

export type ClaimDemoSessionResult =
  | { status: 'none' | 'expired' | 'consumed' | 'invalid' }
  | { status: 'claimed'; leadId: string; workspaceId: string }

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}

function getSecureCookieFlag(): boolean {
  return process.env.NODE_ENV === 'production'
}

function extractRequestIp(request: NextRequest): string | null {
  const forwardedForRaw = request.headers.get('x-forwarded-for')
  if (typeof forwardedForRaw === 'string' && forwardedForRaw.trim().length > 0) {
    const firstIp = forwardedForRaw.split(',')[0]?.trim()
    if (firstIp) return firstIp.slice(0, 120)
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  return realIp ? realIp.slice(0, 120) : null
}

function hashUserAgent(userAgent: string | null): string | null {
  if (!userAgent || userAgent.trim().length === 0) return null
  return sha256Hex(userAgent.trim())
}

export function normalizeDemoHandoffToken(rawToken: string | null | undefined): string | null {
  if (!rawToken) return null
  const token = rawToken.trim()
  if (token.length < 32 || token.length > 256) return null
  return token
}

function inferTriggerEventType(triggerLabel: string): string {
  const normalized = triggerLabel.toLowerCase()
  if (normalized.includes('fund')) return 'funding'
  if (normalized.includes('hiring')) return 'new_hires'
  if (normalized.includes('launch')) return 'product_launch'
  if (normalized.includes('partner')) return 'partnership'
  if (normalized.includes('expand')) return 'expansion'
  return 'demo_signal'
}

function buildLeadPitchFromSample(sample: DemoSessionPayload['sample']): string {
  const topSignals = sample.triggers.slice(0, 3).join(' | ')
  return [
    `[LeadIntel Fit ${sample.score}/100] ${sample.whyNow}`,
    `Top demo signals: ${topSignals}`,
    '',
    sample.outreach.subject ? `Subject: ${sample.outreach.subject}` : '',
    sample.outreach.body,
    '',
    sample.disclaimer,
  ]
    .filter((line) => line.length > 0)
    .join('\n')
}

function fallbackCompanyUrl(payload: DemoSessionPayload): string {
  if (payload.companyUrl) return payload.companyUrl
  if (payload.companyDomain) return `https://${payload.companyDomain}`
  return `https://demo.local/${encodeURIComponent(makeNameCompanyKey(payload.companyName))}`
}

export function getDemoHandoffToken(request: NextRequest): string | null {
  return normalizeDemoHandoffToken(request.cookies.get(DEMO_HANDOFF_COOKIE)?.value ?? null)
}

export function setDemoHandoffCookie(args: {
  response: NextResponse
  token: string
  maxAgeSeconds?: number
}): void {
  args.response.cookies.set(DEMO_HANDOFF_COOKIE, args.token, {
    httpOnly: true,
    secure: getSecureCookieFlag(),
    sameSite: 'lax',
    path: '/',
    maxAge: args.maxAgeSeconds ?? DEMO_HANDOFF_TTL_SECONDS,
  })
}

export function clearDemoHandoffCookie(response: NextResponse): void {
  response.cookies.set(DEMO_HANDOFF_COOKIE, '', {
    httpOnly: true,
    secure: getSecureCookieFlag(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function createDemoSessionHandoff(args: {
  payload: DemoSessionPayload
  request: NextRequest
}): Promise<{ token: string } | null> {
  const validation = DemoSessionPayloadSchema.safeParse(args.payload)
  if (!validation.success) return null

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = sha256Hex(token)
  const expiresAt = new Date(Date.now() + DEMO_HANDOFF_TTL_SECONDS * 1000).toISOString()

  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { error } = await admin.schema('api').from('demo_sessions').insert({
      token_hash: tokenHash,
      payload: validation.data,
      expires_at: expiresAt,
      created_ip: extractRequestIp(args.request),
      user_agent_hash: hashUserAgent(args.request.headers.get('user-agent')),
    })
    if (error) return null
    return { token }
  } catch {
    return null
  }
}

async function consumeInvalidSession(sessionId: string, userId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    await admin
      .schema('api')
      .from('demo_sessions')
      .update({
        consumed_at: new Date().toISOString(),
        claimed_user_id: userId,
      })
      .eq('id', sessionId)
      .is('consumed_at', null)
  } catch {
    // Best-effort cleanup only.
  }
}

export async function claimDemoSessionForUser(args: {
  token: string
  userId: string
  supabase: SupabaseClient
}): Promise<ClaimDemoSessionResult> {
  const token = normalizeDemoHandoffToken(args.token)
  if (!token) return { status: 'none' }

  const admin = createSupabaseAdminClient({ schema: 'api' })
  const tokenHash = sha256Hex(token)

  const { data: sessionData, error: sessionError } = await admin
    .schema('api')
    .from('demo_sessions')
    .select('id, payload, expires_at, consumed_at, claimed_user_id, claimed_lead_id')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (sessionError) throw sessionError

  const session = (sessionData ?? null) as DemoSessionRow | null
  if (!session) return { status: 'none' }

  if (session.consumed_at) {
    if (session.claimed_user_id === args.userId && session.claimed_lead_id) {
      const workspace = await getCurrentWorkspace({ supabase: args.supabase, userId: args.userId })
      if (!workspace) return { status: 'consumed' }
      return { status: 'claimed', leadId: session.claimed_lead_id, workspaceId: workspace.id }
    }
    return { status: 'consumed' }
  }

  const expiresAtMs = Date.parse(session.expires_at)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return { status: 'expired' }
  }

  const payloadValidation = DemoSessionPayloadSchema.safeParse(session.payload)
  if (!payloadValidation.success) {
    await consumeInvalidSession(session.id, args.userId)
    return { status: 'invalid' }
  }

  const payload = payloadValidation.data

  await ensurePersonalWorkspace({
    supabase: args.supabase,
    userId: args.userId,
    name: `${payload.companyName.slice(0, 60)} Workspace`,
  })
  const workspace = await getCurrentWorkspace({ supabase: args.supabase, userId: args.userId })
  if (!workspace) return { status: 'invalid' }

  const companyDomainKey = payload.companyDomain ?? makeNameCompanyKey(payload.companyName)
  const companyUrl = fallbackCompanyUrl(payload)
  const leadPitch = buildLeadPitchFromSample(payload.sample)

  const { data: leadRow, error: upsertError } = await args.supabase
    .from('leads')
    .upsert(
      {
        user_id: args.userId,
        company_name: payload.companyName,
        company_domain: companyDomainKey,
        company_url: companyUrl,
        ai_personalized_pitch: leadPitch,
      },
      { onConflict: 'user_id,company_domain' }
    )
    .select('id')
    .single()

  if (upsertError) throw upsertError
  const lead = leadRow as ClaimedLeadRow

  const signalRows = payload.sample.triggers.slice(0, 3).map((trigger) => ({
    user_id: args.userId,
    lead_id: lead.id,
    event_type: inferTriggerEventType(trigger),
    payload: {
      source: 'demo_handoff',
      trigger,
      score: payload.sample.score,
    },
    company_name: payload.companyName,
    company_domain: payload.companyDomain,
    company_url: payload.companyUrl,
    event_description: trigger,
    headline: trigger,
    detected_at: new Date().toISOString(),
  }))

  if (signalRows.length > 0) {
    try {
      await args.supabase.from('trigger_events').insert(signalRows)
    } catch {
      // Non-critical: lead persistence is the primary handoff objective.
    }
  }

  const { data: consumeRow, error: consumeError } = await admin
    .schema('api')
    .from('demo_sessions')
    .update({
      consumed_at: new Date().toISOString(),
      claimed_user_id: args.userId,
      claimed_workspace_id: workspace.id,
      claimed_lead_id: lead.id,
    })
    .eq('id', session.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle()

  if (consumeError) throw consumeError
  if (!consumeRow) return { status: 'consumed' }

  return { status: 'claimed', leadId: lead.id, workspaceId: workspace.id }
}
