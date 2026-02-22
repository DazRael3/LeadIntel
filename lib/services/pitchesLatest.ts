import type { SupabaseClient } from '@supabase/supabase-js'
import { getLatestPitchForUser } from '@/lib/services/pitches'
import type { LatestPitch } from '@/lib/services/pitches'

export type LatestPitchSummary = {
  id: string
  companyName: string
  createdAt: Date
  previewBullets: string[]
  deepLinkHref: string
}

function pickCompanyKey(latest: LatestPitch): string | null {
  const domain = latest.company.companyDomain?.trim() || null
  if (domain) return domain
  const name = latest.company.companyName?.trim() || null
  if (name) return name
  const url = latest.company.companyUrl?.trim() || null
  if (url) return url
  return null
}

function extractPreviewBullets(content: string, max: number): string[] {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 12)

  const bullets: string[] = []
  for (const line of lines) {
    const cleaned = line.replace(/^[-*•]\s+/, '').trim()
    if (!cleaned) continue
    bullets.push(cleaned.length > 140 ? `${cleaned.slice(0, 140)}…` : cleaned)
    if (bullets.length >= max) break
  }
  return bullets
}

export function buildLatestPitchDeepLink(latest: LatestPitch): string {
  const key = pickCompanyKey(latest)
  if (!key) return '/dashboard'
  return `/dashboard?company=${encodeURIComponent(key)}`
}

export async function getLatestPitchSummaryForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<LatestPitchSummary | null> {
  const latest = await getLatestPitchForUser(supabase, userId)
  if (!latest) return null

  const createdAtMs = Date.parse(latest.createdAt)
  const createdAt = Number.isFinite(createdAtMs) ? new Date(createdAtMs) : new Date()

  const companyName =
    latest.company.companyName?.trim() ||
    latest.company.companyDomain?.trim() ||
    latest.company.companyUrl?.trim() ||
    'Unknown company'

  return {
    id: latest.pitchId,
    companyName,
    createdAt,
    previewBullets: extractPreviewBullets(latest.content, 3),
    deepLinkHref: buildLatestPitchDeepLink(latest),
  }
}

