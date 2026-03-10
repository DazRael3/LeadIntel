import type { SupabaseClient } from '@supabase/supabase-js'
import { validatePayloadTemplate } from '@/lib/extensions/validators'
import { renderPayloadTemplate } from '@/lib/extensions/runtime'
import type { CustomActionDefinition, CustomActionRunContext } from '@/lib/extensions/types'

type DbRow = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  destination_type: string
  endpoint_id: string
  payload_template: unknown
  is_enabled: boolean
  created_by: string
  created_at: string
  updated_at: string
}

function normalize(row: DbRow): CustomActionDefinition {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    description: row.description,
    destination_type: 'webhook',
    endpoint_id: row.endpoint_id,
    payload_template: row.payload_template && typeof row.payload_template === 'object' ? (row.payload_template as Record<string, unknown>) : {},
    is_enabled: Boolean(row.is_enabled),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listCustomActions(args: { supabase: SupabaseClient; workspaceId: string }): Promise<CustomActionDefinition[]> {
  const { data } = await args.supabase
    .schema('api')
    .from('custom_actions')
    .select('id, workspace_id, name, description, destination_type, endpoint_id, payload_template, is_enabled, created_by, created_at, updated_at')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false })
    .limit(200)
  return ((data ?? []) as unknown as DbRow[]).map((r) => normalize(r))
}

export async function createCustomAction(args: {
  supabase: SupabaseClient
  workspaceId: string
  actorUserId: string
  name: string
  description: string | null
  endpointId: string
  payloadTemplate: Record<string, unknown>
}): Promise<{ ok: true; action: CustomActionDefinition } | { ok: false; reason: string }> {
  const valid = validatePayloadTemplate(args.payloadTemplate)
  if (!valid.ok) return { ok: false, reason: valid.reason }

  const { data, error } = await args.supabase
    .schema('api')
    .from('custom_actions')
    .insert({
      workspace_id: args.workspaceId,
      name: args.name,
      description: args.description,
      destination_type: 'webhook',
      endpoint_id: args.endpointId,
      payload_template: args.payloadTemplate,
      is_enabled: true,
      created_by: args.actorUserId,
    })
    .select('id, workspace_id, name, description, destination_type, endpoint_id, payload_template, is_enabled, created_by, created_at, updated_at')
    .single()

  if (error || !data) return { ok: false, reason: 'database_error' }
  return { ok: true, action: normalize(data as unknown as DbRow) }
}

export async function setCustomActionEnabled(args: {
  supabase: SupabaseClient
  workspaceId: string
  actionId: string
  isEnabled: boolean
}): Promise<{ ok: true } | { ok: false }> {
  const { error } = await args.supabase
    .schema('api')
    .from('custom_actions')
    .update({ is_enabled: args.isEnabled })
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.actionId)
  if (error) return { ok: false }
  return { ok: true }
}

export function buildCustomActionPayload(args: { action: CustomActionDefinition; ctx: CustomActionRunContext }): Record<string, unknown> {
  const tpl = args.action.payload_template
  const template = tpl && typeof tpl === 'object' && !Array.isArray(tpl) ? (tpl as Record<string, unknown>) : {}
  return renderPayloadTemplate({ template, ctx: args.ctx })
}

