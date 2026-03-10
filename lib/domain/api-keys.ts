import { z } from 'zod'
import type { WorkspaceRole } from '@/lib/team/workspace'
import type { PlatformScope } from '@/lib/platform-api/types'

export type ApiKeyStatus = 'active' | 'revoked'

export type ApiKeyRow = {
  id: string
  workspace_id: string
  name: string
  prefix: string
  scopes: PlatformScope[]
  created_by: string
  created_at: string
  revoked_at: string | null
  revoked_by: string | null
  last_used_at: string | null
}

export const PlatformScopeSchema = z.enum([
  'workspace.read',
  'accounts.read',
  'action_queue.read',
  'delivery.read',
  'benchmarks.read',
  'embed.token.create',
])

export const ApiKeyCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(PlatformScopeSchema).min(1).max(12),
})

export const ApiKeyRevokeSchema = z.object({
  id: z.string().uuid(),
})

export const ApiKeyAllowedCreatorRoles: WorkspaceRole[] = ['owner', 'admin', 'manager']

