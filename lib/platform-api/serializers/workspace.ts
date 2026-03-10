import type { PlatformObject } from '@/lib/platform-api/objects'

export function serializeWorkspace(args: {
  workspace: { id: string; name: string; created_at: string | null; client_label?: string | null; reference_tags?: unknown }
}): PlatformObject<
  'workspace',
  {
    name: string
    client_label: string | null
    reference_tags: string[]
  }
> {
  return {
    id: args.workspace.id,
    object: 'workspace',
    workspace_id: args.workspace.id,
    created_at: args.workspace.created_at ?? null,
    updated_at: null,
    attributes: {
      name: args.workspace.name,
      client_label: typeof args.workspace.client_label === 'string' ? args.workspace.client_label : null,
      reference_tags: Array.isArray(args.workspace.reference_tags) ? args.workspace.reference_tags.filter((t): t is string => typeof t === 'string') : [],
    },
  }
}

