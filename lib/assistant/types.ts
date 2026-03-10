export type AssistantScopeType = 'workspace' | 'account' | 'command_center' | 'executive' | 'approvals' | 'actions'

export type AssistantMessageRole = 'user' | 'assistant' | 'system'

export type AssistantReference = {
  kind: 'account' | 'action_queue_item' | 'approval' | 'template' | 'route'
  id: string
  label: string
  href: string | null
}

export type AssistantSuggestedAction =
  | { kind: 'open_route'; label: string; href: string }
  | { kind: 'prepare_crm_handoff'; label: string; accountId: string; window: '7d' | '30d' | '90d' | 'all' }
  | { kind: 'prepare_sequencer_handoff'; label: string; accountId: string; window: '7d' | '30d' | '90d' | 'all' }
  | { kind: 'add_to_queue'; label: string; accountId: string; reason: string }
  | { kind: 'request_template_approval'; label: string; templateId: string; note: string | null }

export type AssistantAnswer = {
  answer: string
  sources: AssistantReference[]
  groundingNote: string
  suggestedNext: Array<{ label: string; prompt: string }>
  suggestedActions: AssistantSuggestedAction[]
  limitationsNote: string | null
}

export type AssistantThreadTarget = { targetType: AssistantScopeType; targetId: string | null }

