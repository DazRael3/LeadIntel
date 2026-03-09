import type { SupabaseClient } from '@supabase/supabase-js'
import { USE_CASE_PLAYBOOKS } from '@/lib/use-cases/playbooks'
import { BENCHMARK_PRIVACY_VERSION } from '@/lib/benchmarking/privacy'
import { confidenceFromEvents } from '@/lib/benchmarking/aggregation'

export const CATEGORY_SIGNAL_INTELLIGENCE_VERSION = `category_signal_v1:${BENCHMARK_PRIVACY_VERSION}`

export type CategorySignalInsight = {
  playbookSlug: string
  label: string
  summary: string
  evidence: 'workspace_only'
  confidence: 'limited' | 'usable' | 'strong'
  limitationsNote: string | null
}

function safeMeta(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}
}

export async function getCategorySignalInsights(args: {
  supabase: SupabaseClient
  workspaceId: string
  windowDays: number
}): Promise<{ insights: CategorySignalInsight[]; computedAt: string; version: string }> {
  const sinceIso = new Date(Date.now() - Math.max(7, Math.min(90, args.windowDays)) * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await args.supabase
    .schema('api')
    .from('action_queue_items')
    .select('status, payload_meta, created_at')
    .eq('workspace_id', args.workspaceId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(2000)

  const items = (data ?? []) as unknown as Array<{ status?: unknown; payload_meta?: unknown }>
  const counts: Record<string, { total: number; delivered: number }> = {}
  for (const it of items) {
    const meta = safeMeta(it.payload_meta)
    const slug = typeof meta.playbookSlug === 'string' ? meta.playbookSlug : null
    if (!slug) continue
    if (!counts[slug]) counts[slug] = { total: 0, delivered: 0 }
    counts[slug]!.total += 1
    if (it.status === 'delivered') counts[slug]!.delivered += 1
  }

  const scored = Object.entries(counts)
    .map(([slug, c]) => ({ slug, total: c.total, delivered: c.delivered, rate: c.total > 0 ? c.delivered / c.total : 0 }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 4)

  const bySlug = new Map(USE_CASE_PLAYBOOKS.map((p) => [p.slug, p.title] as const))

  const insights: CategorySignalInsight[] = scored.map((s) => {
    const title = bySlug.get(s.slug) ?? s.slug
    const conf = confidenceFromEvents(s.total)
    const summary =
      conf === 'limited'
        ? `Evidence is limited for this signal family in your workspace.`
        : s.rate >= 0.6
          ? `When this signal family is present, your prepared actions tend to complete more often.`
          : `This signal family shows mixed completion in your workspace; follow-through hygiene matters.`
    return {
      playbookSlug: s.slug,
      label: title,
      summary,
      evidence: 'workspace_only',
      confidence: conf,
      limitationsNote: conf === 'limited' ? 'This is based on small samples; treat as a directional cue.' : 'This is not a market benchmark; it reflects workspace activity only.',
    }
  })

  return { insights, computedAt: new Date().toISOString(), version: CATEGORY_SIGNAL_INTELLIGENCE_VERSION }
}

