import type { WorkspaceIntegrationStatus, ConnectionState, IntegrationId } from '@/lib/integrations/types'

export function status(args: {
  id: IntegrationId
  enabled: boolean
  state: ConnectionState
  blockingReason?: string
  detail?: string
}): WorkspaceIntegrationStatus {
  return {
    id: args.id,
    enabled: args.enabled,
    state: args.state,
    ...(args.blockingReason ? { blockingReason: args.blockingReason } : {}),
    ...(args.detail ? { detail: args.detail } : {}),
  }
}

