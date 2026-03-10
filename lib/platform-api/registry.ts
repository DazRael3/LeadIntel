import type { PlatformScope } from '@/lib/platform-api/types'

export type PlatformRouteSpec = {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  summary: string
  requiredScopes: PlatformScope[]
}

export const PLATFORM_API_V1_ROUTES: PlatformRouteSpec[] = [
  { method: 'GET', path: '/api/v1/health', summary: 'Health check', requiredScopes: [] },
  { method: 'GET', path: '/api/v1/workspace', summary: 'Workspace metadata', requiredScopes: ['workspace.read'] },
  { method: 'GET', path: '/api/v1/accounts', summary: 'List workspace accounts (program list)', requiredScopes: ['accounts.read'] },
  { method: 'GET', path: '/api/v1/action-queue', summary: 'List action queue items', requiredScopes: ['action_queue.read'] },
  { method: 'GET', path: '/api/v1/delivery-history', summary: 'List delivery history', requiredScopes: ['delivery.read'] },
  { method: 'GET', path: '/api/v1/benchmarks/workflow', summary: 'Workflow benchmarks (summary-safe)', requiredScopes: ['benchmarks.read'] },
  { method: 'POST', path: '/api/v1/embed/tokens', summary: 'Mint signed embed token', requiredScopes: ['embed.token.create'] },
]

