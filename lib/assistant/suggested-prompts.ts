import type { AssistantScopeType } from '@/lib/assistant/types'

export function suggestedPromptsForScope(scope: AssistantScopeType): Array<{ label: string; prompt: string }> {
  if (scope === 'account') {
    return [
      { label: 'Why now?', prompt: 'Why is this account prioritized right now? Summarize the top reasons.' },
      { label: 'Next step', prompt: 'What is the next best action for this account and why?' },
      { label: 'Blockers', prompt: 'What is missing or weak for this account? Be explicit about limitations.' },
      { label: 'Prepare handoff', prompt: 'Help me prepare a CRM handoff for this account.' },
    ]
  }
  if (scope === 'command_center') {
    return [
      { label: 'Act now', prompt: 'Summarize the Act now lane and suggest the top 3 moves.' },
      { label: 'Blockers', prompt: 'What is blocked today and what should we do first?' },
      { label: 'Approvals', prompt: 'What approvals are pending and who should review them?' },
    ]
  }
  if (scope === 'executive') {
    return [
      { label: 'Headline', prompt: 'Give me an executive headline for today and the top 3 priorities.' },
      { label: 'Risks', prompt: 'What are the biggest workflow risks right now?' },
      { label: 'Blockers', prompt: 'What is blocking progress and what decision is needed?' },
    ]
  }
  return [
    { label: 'What changed?', prompt: 'What changed recently and what should I focus on next?' },
    { label: 'Blockers', prompt: 'What is blocked or waiting and why?' },
  ]
}

