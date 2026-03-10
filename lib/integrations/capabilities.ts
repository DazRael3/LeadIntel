import type { IntegrationCapability, IntegrationDescriptor, WorkspaceIntegrationStatus } from '@/lib/integrations/types'

export type AvailableAccountActions = {
  canPrepareCrmHandoff: boolean
  canPrepareSequencerHandoff: boolean
  canDeliverViaWebhook: boolean
  canExport: boolean
  whyUnavailable?: string
}

export function isReady(st: WorkspaceIntegrationStatus): boolean {
  return st.state === 'ready'
}

export function capabilitySummary(desc: IntegrationDescriptor): string[] {
  const c: IntegrationCapability = desc.capabilities
  const out: string[] = []
  if (c.acceptsWebhookDelivery) out.push('Webhook delivery')
  if (c.acceptsExportDelivery) out.push('Export delivery')
  if (c.acceptsAccountPush) out.push('Account handoff')
  if (c.acceptsTaskCreate) out.push('Task-style handoff')
  if (c.acceptsNoteCreate) out.push('Note-style handoff')
  if (c.acceptsSequenceHandoff) out.push('Sequence package')
  if (c.acceptsPlaybookSync) out.push('Playbooks/templates')
  return out
}

