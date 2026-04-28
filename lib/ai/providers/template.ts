import type { AiProviderAdapter, AiTaskType } from '@/lib/ai/providers/types'
import { toModelResult } from '@/lib/ai/providers/shared'

const OUTREACH_TEMPLATE = [
  'Hi there,',
  '',
  'Noticed a relevant signal for your team and wanted to share a practical idea.',
  'If useful, I can send a short workflow outline tailored to your current priorities.',
  '',
  'Best,',
  'LeadIntel',
].join('\n')

function conciseSummary(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'No summary available right now.'
  if (cleaned.length <= 220) return cleaned
  return `${cleaned.slice(0, 220).trim()}...`
}

function deterministicTaskFallback(task: AiTaskType, prompt: string): string {
  if (task === 'outreach_draft') return OUTREACH_TEMPLATE
  if (task === 'subject_line') return 'Quick idea for your current pipeline priorities'
  if (task === 'signal_classification') return 'Signal appears relevant and should be reviewed for outreach timing.'
  if (task === 'scoring_explanation') {
    return 'Score explanation is based on deterministic fit factors: industry alignment, role match, and observed signals.'
  }
  return conciseSummary(prompt)
}

export const generateWithTemplate: AiProviderAdapter = async (input, context) => {
  return toModelResult({
    provider: 'template',
    model: 'deterministic-template-v1',
    text: deterministicTaskFallback(input.task, input.prompt),
    requestId: context.requestId,
  })
}
