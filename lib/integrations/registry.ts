import type { IntegrationDescriptor } from '@/lib/integrations/types'

export const INTEGRATIONS: IntegrationDescriptor[] = [
  {
    id: 'webhooks',
    family: 'webhook',
    name: 'Webhooks',
    shortDescription: 'Deliver action payloads into your system reliably with retries.',
    setupHint: 'Create a workspace webhook endpoint and choose subscribed events.',
    capabilities: { acceptsWebhookDelivery: true, requiresWebhookEndpoint: true, requiresWorkspaceConfig: true },
    implementation: 'native',
  },
  {
    id: 'exports',
    family: 'export',
    name: 'CSV exports',
    shortDescription: 'Download operator-safe CSVs for handoff and reporting.',
    setupHint: 'Use Exports to generate downloadable CSV files.',
    capabilities: { acceptsExportDelivery: true },
    implementation: 'native',
  },
  {
    id: 'crm_handoff',
    family: 'crm',
    name: 'CRM handoff (via webhook/export)',
    shortDescription: 'Package an account handoff for CRM logging (task/note style payloads).',
    setupHint: 'Configure a default webhook destination for handoff delivery.',
    capabilities: { acceptsAccountPush: true, acceptsTaskCreate: true, acceptsNoteCreate: true, requiresWebhookEndpoint: true, requiresWorkspaceConfig: true },
    implementation: 'via_webhook',
  },
  {
    id: 'sequencer_handoff',
    family: 'sequencer',
    name: 'Sequencer handoff (via webhook/export)',
    shortDescription: 'Prepare a sequence-ready package (opener + variants + why-now context).',
    setupHint: 'Configure a default webhook destination for handoff delivery.',
    capabilities: { acceptsSequenceHandoff: true, requiresWebhookEndpoint: true, requiresWorkspaceConfig: true },
    implementation: 'via_webhook',
  },
  {
    id: 'team_playbooks',
    family: 'playbooks',
    name: 'Team playbooks',
    shortDescription: 'Standardize approved templates and governance across reps.',
    setupHint: 'Use Templates and approval to govern shared playbooks.',
    capabilities: { acceptsPlaybookSync: true },
    implementation: 'workspace_internal',
  },
]

export function getIntegrationDescriptor(id: IntegrationDescriptor['id']): IntegrationDescriptor {
  const found = INTEGRATIONS.find((x) => x.id === id)
  if (!found) throw new Error('unknown_integration')
  return found
}

