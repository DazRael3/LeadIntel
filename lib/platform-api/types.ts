export type PlatformApiVersion = 'v1'

export type PlatformScope =
  | 'workspace.read'
  | 'accounts.read'
  | 'action_queue.read'
  | 'delivery.read'
  | 'benchmarks.read'
  | 'embed.token.create'

export type PlatformAuthContext = {
  apiVersion: PlatformApiVersion
  workspaceId: string
  apiKeyId: string
  scopes: PlatformScope[]
  requestId: string
}

export type PlatformPagination = {
  nextCursor: string | null
}

