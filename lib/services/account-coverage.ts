import type { SupabaseClient } from '@supabase/supabase-js'
import type { CoverageSummary, AccountProgramState, CoverageSignal } from '@/lib/coverage/types'
import { deriveCoverageConfidence } from '@/lib/coverage/confidence'
import { deriveCoverageState } from '@/lib/coverage/ownership'
import { resolveTerritoryMatch } from '@/lib/services/territory-logic'
import type { AccountExplainability } from '@/lib/data/getAccountExplainability'

type ProgramRow = {
  program_state: string
  note: string | null
  account_domain: string | null
  account_name: string | null
  updated_at: string
}

type QueueRow = {
  id: string
  status: string
  action_type: string
  assigned_to_user_id: string | null
  created_at: string
  error: string | null
  payload_meta: unknown
}

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}

function programStateFromRow(row: ProgramRow | null): AccountProgramState {
  const v = (row?.program_state ?? '').trim()
  if (v === 'strategic' || v === 'named' || v === 'expansion_watch' || v === 'monitor' || v === 'standard') return v
  return 'standard'
}

function metaStr(meta: unknown, key: string): string | null {
  if (!meta || typeof meta !== 'object') return null
  const v = (meta as Record<string, unknown>)[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export async function buildAccountCoverageSummary(args: {
  supabase: SupabaseClient
  workspaceId: string
  accountId: string
  accountDomain: string | null
  window: '7d' | '30d' | '90d' | 'all'
  ex: AccountExplainability
}): Promise<CoverageSummary> {
  const computedAt = new Date().toISOString()

  const [programRes, queueRes] = await Promise.all([
    args.supabase
      .schema('api')
      .from('account_program_accounts')
      .select('program_state, note, account_domain, account_name, updated_at')
      .eq('workspace_id', args.workspaceId)
      .eq('lead_id', args.accountId)
      .maybeSingle(),
    args.supabase
      .schema('api')
      .from('action_queue_items')
      .select('id, status, action_type, assigned_to_user_id, created_at, error, payload_meta')
      .eq('workspace_id', args.workspaceId)
      .eq('lead_id', args.accountId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const programRow = (programRes.data ?? null) as unknown as ProgramRow | null
  const programState = programStateFromRow(programRow)

  const queueItems = (queueRes.data ?? []) as unknown as QueueRow[]
  const assigned = uniq(queueItems.map((q) => q.assigned_to_user_id ?? '').filter(Boolean))
  const hasBlocked = queueItems.some((q) => q.status === 'failed' || q.status === 'blocked')

  const mostRecentAt = queueItems[0]?.created_at ?? null
  const recentMs = mostRecentAt ? Date.parse(mostRecentAt) : NaN
  const hasRecentActivity = Number.isFinite(recentMs) ? Date.now() - recentMs < 14 * 24 * 60 * 60 * 1000 : false

  const territory = await resolveTerritoryMatch({ supabase: args.supabase, workspaceId: args.workspaceId, accountDomain: args.accountDomain, tags: [] })

  const conf = deriveCoverageConfidence(args.ex)
  const derived = deriveCoverageState({ assignedUserIds: assigned, hasBlocked, hasRecentActivity, programState })

  const signals: CoverageSignal[] = [
    { label: 'Momentum', detail: `${args.ex.momentum.label} (${args.ex.momentum.delta >= 0 ? '+' : ''}${args.ex.momentum.delta})`, observed: true },
    { label: 'First-party intent', detail: args.ex.firstPartyIntent.summary.labelText, observed: true },
    { label: 'Data quality', detail: `${args.ex.dataQuality.quality} / ${args.ex.dataQuality.freshness}`, observed: true },
    { label: 'Assigned owners', detail: assigned.length > 0 ? `${assigned.length} assigned` : 'None', observed: true },
    territory.matched
      ? { label: 'Territory match', detail: `${territory.territoryKey}`, observed: true }
      : { label: 'Territory match', detail: 'No match', observed: true },
  ]

  const reasonSummary = derived.reason
  const limitationsNote = conf.limitationsNote
    ? `${conf.limitationsNote} Coverage signals reflect workflow activity, not CRM territory sync or account hierarchy certainty.`
    : 'Coverage signals reflect workflow activity, not CRM territory sync or account hierarchy certainty.'

  return {
    type: 'account_coverage_summary',
    version: 'coverage_v1',
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    window: args.window,
    computedAt,
    confidence: conf.label,
    state: derived.state,
    ownerUserIds: [], // Lead ownership is user-scoped; workspace ownership is represented via assignments.
    assignedUserIds: assigned,
    territory,
    programState,
    reasonSummary,
    signals,
    limitationsNote,
    nextAction: derived.nextAction,
  }
}

