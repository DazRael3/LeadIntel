import type { SupabaseClient } from '@supabase/supabase-js'
import { TEMPLATE_LIBRARY } from '@/lib/templates/registry'
import { COMPARE_PAGES } from '@/lib/compare/registry'
import { USE_CASES } from '@/lib/use-cases/registry'

export type PublishQueueType = 'template' | 'use_case' | 'compare' | 'tour' | 'roi'

export type Publishable = {
  type: PublishQueueType
  slug: string
  path: string
  title: string
  summary: string
}

export function listPublishables(): Publishable[] {
  const templates: Publishable[] = TEMPLATE_LIBRARY.map((t) => ({
    type: 'template',
    slug: t.slug,
    path: `/templates/${t.slug}`,
    title: t.title,
    summary: `Outreach template (${t.channel}) for ${t.trigger.replace(/_/g, ' ')} signals.`,
  }))

  const useCases: Publishable[] = USE_CASES.map((u) => ({
    type: 'use_case',
    slug: u.slug,
    path: u.href,
    title: u.title,
    summary: u.whyNow,
  }))

  const compares: Publishable[] = COMPARE_PAGES.map((p) => ({
    type: 'compare',
    slug: p.slug,
    path: `/compare/${p.slug}`,
    title: `LeadIntel vs ${p.competitorName}`,
    summary: p.bestFor,
  }))

  const tour: Publishable[] = [
    {
      type: 'tour',
      slug: 'tour',
      path: '/tour',
      title: 'Product tour',
      summary: 'From signals to send-ready outreach in minutes.',
    },
  ]

  // ROI is only seeded when a real /roi route exists.
  return [...tour, ...compares, ...useCases, ...templates]
}

export async function seedPublishQueue(args: {
  supabase: SupabaseClient<any, 'api', any>
}): Promise<{ inserted: number; total: number }> {
  const items = listPublishables()
  if (items.length === 0) return { inserted: 0, total: 0 }

  // Insert missing rows only (idempotent).
  const rows = items.map((i) => ({
    type: i.type,
    slug: i.slug,
    status: 'queued' as const,
    scheduled_for: new Date().toISOString(),
  }))

  const { data, error } = await args.supabase
    .from('publish_queue')
    .upsert(rows, { onConflict: 'type,slug', ignoreDuplicates: true })
    .select('id')

  // Some PostgREST versions ignore ignoreDuplicates; still safe due to unique index + upsert.
  if (error) {
    // If schema isn't applied, callers treat as "no-op".
    return { inserted: 0, total: items.length }
  }

  return { inserted: Array.isArray(data) ? data.length : 0, total: items.length }
}

