import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type DataHealthSourceType = 'gdelt' | 'first_party' | 'greenhouse' | 'lever' | 'sec'

export type DataHealthSummary = {
  updatedAt: string
  leadsTracked: number
  signals: { last24h: number; last7d: number }
  websiteVisitors: { last24h: number; last14d: number }
  companySnapshots: {
    byType: Record<DataHealthSourceType, { fetchedLast24h: number; errorsLast24h: number }>
  }
}

const SOURCE_TYPES: DataHealthSourceType[] = ['gdelt', 'first_party', 'greenhouse', 'lever', 'sec']

function isoHoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString()
}

function isoDaysAgo(d: number): string {
  return new Date(Date.now() - d * 24 * 3600 * 1000).toISOString()
}

export async function computeDataHealthSummary(): Promise<DataHealthSummary> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const updatedAt = new Date().toISOString()

  const since24h = isoHoursAgo(24)
  const since7d = isoDaysAgo(7)
  const since14d = isoDaysAgo(14)

  const [leadsRes, signals24Res, signals7Res, visitors24Res, visitors14Res] = await Promise.all([
    admin.from('leads').select('id', { count: 'exact', head: true }),
    admin.from('trigger_events').select('id', { count: 'exact', head: true }).gte('detected_at', since24h),
    admin.from('trigger_events').select('id', { count: 'exact', head: true }).gte('detected_at', since7d),
    admin.from('website_visitors').select('id', { count: 'exact', head: true }).gte('visited_at', since24h),
    admin.from('website_visitors').select('id', { count: 'exact', head: true }).gte('visited_at', since14d),
  ])

  const byTypeEntries = await Promise.all(
    SOURCE_TYPES.map(async (t) => {
      const [fetchedRes, errorRes] = await Promise.all([
        admin.from('company_source_snapshots').select('id', { count: 'exact', head: true }).gte('fetched_at', since24h).eq('source_type', t),
        admin.from('company_source_snapshots').select('id', { count: 'exact', head: true }).gte('fetched_at', since24h).eq('source_type', t).eq('status', 'error'),
      ])
      return [
        t,
        {
          fetchedLast24h: typeof fetchedRes.count === 'number' ? fetchedRes.count : 0,
          errorsLast24h: typeof errorRes.count === 'number' ? errorRes.count : 0,
        },
      ] as const
    })
  )

  const byType = Object.fromEntries(byTypeEntries) as Record<DataHealthSourceType, { fetchedLast24h: number; errorsLast24h: number }>

  return {
    updatedAt,
    leadsTracked: typeof leadsRes.count === 'number' ? leadsRes.count : 0,
    signals: {
      last24h: typeof signals24Res.count === 'number' ? signals24Res.count : 0,
      last7d: typeof signals7Res.count === 'number' ? signals7Res.count : 0,
    },
    websiteVisitors: {
      last24h: typeof visitors24Res.count === 'number' ? visitors24Res.count : 0,
      last14d: typeof visitors14Res.count === 'number' ? visitors14Res.count : 0,
    },
    companySnapshots: { byType },
  }
}

