import type { AssistantScopeType } from '@/lib/assistant/types'

export type AssistantIntent =
  | { kind: 'account_summary' }
  | { kind: 'next_best_action' }
  | { kind: 'prepare_crm_handoff' }
  | { kind: 'prepare_sequencer_handoff' }
  | { kind: 'command_center_summary' }
  | { kind: 'executive_summary' }
  | { kind: 'approvals_summary' }
  | { kind: 'unknown' }

function hasAny(s: string, words: string[]): boolean {
  return words.some((w) => s.includes(w))
}

export function routeAssistantQuery(args: { scope: AssistantScopeType; message: string }): AssistantIntent {
  const m = args.message.trim().toLowerCase()
  if (!m) return { kind: 'unknown' }

  if (args.scope === 'account') {
    if (hasAny(m, ['crm handoff', 'handoff to crm', 'crm task', 'crm note'])) return { kind: 'prepare_crm_handoff' }
    if (hasAny(m, ['sequencer', 'sequence package', 'handoff to sequence'])) return { kind: 'prepare_sequencer_handoff' }
    if (hasAny(m, ['next best action', 'next action', 'what should i do next', 'what should we do next'])) return { kind: 'next_best_action' }
    if (hasAny(m, ['why now', 'why is', 'prioritized', 'rising'])) return { kind: 'account_summary' }
    return { kind: 'account_summary' }
  }

  if (args.scope === 'command_center') {
    if (hasAny(m, ['blocked', 'why blocked', 'stale', 'follow-through', 'follow through'])) return { kind: 'command_center_summary' }
    if (hasAny(m, ['approvals', 'review needed', 'pending review'])) return { kind: 'approvals_summary' }
    return { kind: 'command_center_summary' }
  }

  if (args.scope === 'executive') return { kind: 'executive_summary' }
  if (args.scope === 'approvals') return { kind: 'approvals_summary' }

  return { kind: 'unknown' }
}

