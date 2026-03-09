import type { SupabaseClient } from '@supabase/supabase-js'
import { INTEGRATIONS } from '@/lib/integrations/registry'
import type { WorkspaceIntegrationSummary } from '@/lib/integrations/types'
import { status } from '@/lib/integrations/connection-state'

export async function getWorkspaceIntegrationSummary(args: {
  supabase: SupabaseClient
  workspaceId: string
  role: 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'
}): Promise<WorkspaceIntegrationSummary> {
  const { data: ws } = await args.supabase
    .schema('api')
    .from('workspaces')
    .select('id, default_handoff_webhook_endpoint_id')
    .eq('id', args.workspaceId)
    .maybeSingle()

  const defaultHandoffWebhookEndpointId =
    (ws as { default_handoff_webhook_endpoint_id?: unknown } | null)?.default_handoff_webhook_endpoint_id
  const defaultId = typeof defaultHandoffWebhookEndpointId === 'string' ? defaultHandoffWebhookEndpointId : null

  const { count: enabledWebhookCount } = await args.supabase
    .schema('api')
    .from('webhook_endpoints')
    .select('id', { head: true, count: 'exact' })
    .eq('workspace_id', args.workspaceId)
    .eq('is_enabled', true)

  const hasEnabledWebhooks = (typeof enabledWebhookCount === 'number' ? enabledWebhookCount : 0) > 0
  const hasDefaultWebhook = Boolean(defaultId)

  const integrations = INTEGRATIONS.map((desc) => {
    if (desc.id === 'webhooks') {
      const st = hasEnabledWebhooks
        ? status({ id: desc.id, enabled: true, state: 'ready', detail: 'At least one enabled endpoint is configured.' })
        : status({ id: desc.id, enabled: false, state: 'not_connected', blockingReason: 'No enabled webhook endpoints yet.' })
      return { ...desc, status: st }
    }
    if (desc.id === 'exports') {
      // Exports exist as a Team-gated workspace feature.
      const st = status({ id: desc.id, enabled: true, state: 'ready', detail: 'CSV export jobs are available for this workspace.' })
      return { ...desc, status: st }
    }
    if (desc.id === 'crm_handoff' || desc.id === 'sequencer_handoff') {
      if (!hasEnabledWebhooks) {
        const st = status({
          id: desc.id,
          enabled: false,
          state: 'not_connected',
          blockingReason: 'Requires at least one enabled webhook endpoint.',
        })
        return { ...desc, status: st }
      }
      if (!hasDefaultWebhook) {
        const st = status({
          id: desc.id,
          enabled: true,
          state: 'configured',
          blockingReason: 'Set a default handoff destination to enable one-click delivery.',
        })
        return { ...desc, status: st }
      }
      const st = status({ id: desc.id, enabled: true, state: 'ready', detail: 'Handoff can be delivered via the default webhook destination.' })
      return { ...desc, status: st }
    }

    // Workspace internal features (templates governance).
    const st = status({ id: desc.id, enabled: true, state: 'ready', detail: 'Available in this workspace.' })
    return { ...desc, status: st }
  })

  return {
    workspaceId: args.workspaceId,
    role: args.role,
    integrations,
    defaults: { handoffWebhookEndpointId: defaultId },
  }
}

