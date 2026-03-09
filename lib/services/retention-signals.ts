import type { SupabaseClient } from '@supabase/supabase-js'

export type RetentionSignal = {
  key: 'recent_activity' | 'no_recent_activity'
  label: string
  state: 'good' | 'caution'
  detail: string
}

export async function deriveWorkspaceRetentionSignals(args: {
  supabase: SupabaseClient
  workspaceId: string
  now?: Date
}): Promise<{ signals: RetentionSignal[]; note: string }> {
  const now = args.now ?? new Date()
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: recent } = await args.supabase
    .schema('api')
    .from('growth_events')
    .select('id')
    .eq('workspace_id', args.workspaceId)
    .gte('created_at', since7d)
    .limit(1)

  const hasRecent = Array.isArray(recent) && recent.length > 0
  const signals: RetentionSignal[] = hasRecent
    ? [
        {
          key: 'recent_activity',
          label: 'Recent activity',
          state: 'good',
          detail: 'Growth events were recorded in the last 7 days.',
        },
      ]
    : [
        {
          key: 'no_recent_activity',
          label: 'Low recent activity',
          state: 'caution',
          detail: 'No growth events recorded in the last 7 days. This can indicate low adoption or disabled analytics.',
        },
      ]

  return {
    signals,
    note: 'Retention signals are operational heuristics derived from in-product events. They are not churn prediction.',
  }
}

