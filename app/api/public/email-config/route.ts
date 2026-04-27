import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok } from '@/lib/api/http'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DomainList =
  | {
      object: 'list'
      has_more: boolean
      data: Array<{
        id: string
        name: string
        status: string
        capabilities?: { sending?: 'enabled' | 'disabled'; receiving?: 'enabled' | 'disabled' }
      }>
    }
  | { object?: string; data?: unknown }

function getApexHostFromSiteUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    return host.startsWith('www.') ? host.slice(4) : host
  } catch {
    return null
  }
}

function isDomainVerifiedStatus(status: string): boolean {
  const s = status.toLowerCase()
  // Resend statuses are documented on their dashboard; treat anything except a clearly verified state as not enabled.
  return s === 'verified'
}

async function isResendConfiguredForSiteDomain(): Promise<boolean> {
  const resendApiKey = (process.env.RESEND_API_KEY ?? '').trim()
  if (!resendApiKey) return false

  const siteDomain = getApexHostFromSiteUrl()
  if (!siteDomain) return false

  const resend = new Resend(resendApiKey)
  try {
    const { data, error } = await resend.domains.list()
    if (error || !data) return false

    const payload = data as unknown as DomainList
    const domains = Array.isArray(payload.data) ? payload.data : []
    const match = domains.find((d) => d && typeof d.name === 'string' && d.name.toLowerCase() === siteDomain) ?? null
    if (!match) return false

    const sendingEnabled = match.capabilities?.sending === 'enabled'
    const statusOk = typeof match.status === 'string' && isDomainVerifiedStatus(match.status)
    return Boolean(sendingEnabled && statusOk)
  } catch {
    return false
  }
}

export const GET = withApiGuard(async (_request: NextRequest, { requestId }) => {
  const enabled = await isResendConfiguredForSiteDomain()
  return ok({ enabled }, undefined, undefined, requestId)
})

