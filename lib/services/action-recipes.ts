import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { ActionRecipeAction, ActionRecipeConditions, ActionRecipeRow, ActionRecipeTrigger } from '@/lib/domain/action-recipes'
import type { AccountExplainability } from '@/lib/data/getAccountExplainability'
import { createActionQueueItem } from '@/lib/services/action-queue'

const TriggerSchema = z.enum([
  'manual_action',
  'brief_saved',
  'report_generated',
  'tracked_account_added',
  'account_score_threshold',
  'momentum_state',
  'first_party_intent_state',
])

const ActionSchema = z.enum([
  'prepare_crm_handoff',
  'prepare_sequencer_handoff',
  'deliver_webhook_payload',
  'create_export_job',
  'require_manual_review',
  'save_queue_item',
])

const ConditionsSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('account_score_threshold'), minScore: z.number().int().min(0).max(100) }),
  z.object({ type: z.literal('momentum_state'), state: z.enum(['rising', 'steady', 'cooling']) }),
  z.object({ type: z.literal('first_party_intent_state'), state: z.enum(['active', 'inactive']) }),
  z.object({ type: z.literal('data_quality'), quality: z.enum(['limited', 'usable', 'strong']) }),
])

export const RecipeInputSchema = z.object({
  name: z.string().min(1).max(80),
  trigger_type: TriggerSchema,
  conditions: ConditionsSchema.default({ type: 'none' }),
  action_type: ActionSchema,
  destination_type: z.enum(['webhook', 'export']).nullable().optional().default(null),
  destination_id: z.string().uuid().nullable().optional().default(null),
  is_enabled: z.boolean().optional().default(true),
})

type DbRow = {
  id: string
  workspace_id: string
  name: string
  trigger_type: string
  conditions: unknown
  action_type: string
  destination_type: string | null
  destination_id: string | null
  is_enabled: boolean
  created_by: string
  created_at: string
  updated_at: string
}

function normalize(row: DbRow): ActionRecipeRow {
  const trigger = TriggerSchema.safeParse(row.trigger_type).success ? (row.trigger_type as ActionRecipeTrigger) : 'manual_action'
  const action = ActionSchema.safeParse(row.action_type).success ? (row.action_type as ActionRecipeAction) : 'save_queue_item'
  const condParsed = ConditionsSchema.safeParse(row.conditions)
  const conditions: ActionRecipeConditions = condParsed.success ? condParsed.data : { type: 'none' }
  const destType = row.destination_type === 'webhook' || row.destination_type === 'export' ? row.destination_type : null
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    trigger_type: trigger,
    conditions,
    action_type: action,
    destination_type: destType,
    destination_id: row.destination_id,
    is_enabled: Boolean(row.is_enabled),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listActionRecipes(args: { supabase: SupabaseClient; workspaceId: string }): Promise<ActionRecipeRow[]> {
  const { data } = await args.supabase
    .schema('api')
    .from('action_recipes')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false })
    .limit(200)
  return (data ?? []).map((r) => normalize(r as unknown as DbRow))
}

export async function createActionRecipe(args: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
  input: z.infer<typeof RecipeInputSchema>
}): Promise<ActionRecipeRow> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('action_recipes')
    .insert({
      workspace_id: args.workspaceId,
      name: args.input.name,
      trigger_type: args.input.trigger_type,
      conditions: args.input.conditions ?? { type: 'none' },
      action_type: args.input.action_type,
      destination_type: args.input.destination_type ?? null,
      destination_id: args.input.destination_id ?? null,
      is_enabled: args.input.is_enabled ?? true,
      created_by: args.userId,
    })
    .select('*')
    .single()
  if (error || !data) throw new Error('failed_to_create_recipe')
  return normalize(data as unknown as DbRow)
}

export async function updateActionRecipe(args: {
  supabase: SupabaseClient
  workspaceId: string
  recipeId: string
  input: Partial<z.infer<typeof RecipeInputSchema>>
}): Promise<ActionRecipeRow> {
  const patch = {
    ...(typeof args.input.name === 'string' ? { name: args.input.name } : {}),
    ...(typeof args.input.trigger_type === 'string' ? { trigger_type: args.input.trigger_type } : {}),
    ...(args.input.conditions ? { conditions: args.input.conditions } : {}),
    ...(typeof args.input.action_type === 'string' ? { action_type: args.input.action_type } : {}),
    ...(args.input.destination_type !== undefined ? { destination_type: args.input.destination_type } : {}),
    ...(args.input.destination_id !== undefined ? { destination_id: args.input.destination_id } : {}),
    ...(typeof args.input.is_enabled === 'boolean' ? { is_enabled: args.input.is_enabled } : {}),
  }
  const { data, error } = await args.supabase
    .schema('api')
    .from('action_recipes')
    .update(patch)
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.recipeId)
    .select('*')
    .single()
  if (error || !data) throw new Error('failed_to_update_recipe')
  return normalize(data as unknown as DbRow)
}

export function recipeMatchesAccount(args: { recipe: ActionRecipeRow; explainability: AccountExplainability }): boolean {
  const r = args.recipe
  if (!r.is_enabled) return false
  const ex = args.explainability
  const c = r.conditions
  if (c.type === 'none') return true
  if (c.type === 'account_score_threshold') return ex.scoreExplainability.score >= c.minScore
  if (c.type === 'momentum_state') return ex.momentum?.label === c.state
  if (c.type === 'first_party_intent_state') {
    const active = (ex.firstPartyIntent?.visitorMatches?.count ?? 0) > 0
    return c.state === 'active' ? active : !active
  }
  if (c.type === 'data_quality') return ex.dataQuality.quality === c.quality
  return false
}

export async function runRecipesForTrigger(args: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
  trigger: ActionRecipeTrigger
  leadId: string | null
  explainability?: AccountExplainability | null
  triggerMeta?: Record<string, unknown> | null
  reason: string
}): Promise<{ createdQueueItemIds: string[] }> {
  const recipes = await listActionRecipes({ supabase: args.supabase, workspaceId: args.workspaceId })
  const applicable = recipes.filter((r) => r.trigger_type === args.trigger && r.is_enabled)
  const matched =
    args.explainability && applicable.length > 0
      ? applicable.filter((r) => recipeMatchesAccount({ recipe: r, explainability: args.explainability as AccountExplainability }))
      : applicable

  const created: string[] = []
  for (const r of matched) {
    if (r.action_type === 'prepare_crm_handoff') {
      const qi = await createActionQueueItem({
        supabase: args.supabase,
        workspaceId: args.workspaceId,
        userId: args.userId,
        leadId: args.leadId,
        actionType: 'crm_handoff_prepared',
        status: 'ready',
        destinationType: r.destination_type,
        destinationId: r.destination_id,
        reason: args.reason,
        payloadMeta: { recipeId: r.id, recipeName: r.name },
      })
      created.push(qi.id)
    } else if (r.action_type === 'prepare_sequencer_handoff') {
      const qi = await createActionQueueItem({
        supabase: args.supabase,
        workspaceId: args.workspaceId,
        userId: args.userId,
        leadId: args.leadId,
        actionType: 'sequencer_handoff_prepared',
        status: 'ready',
        destinationType: r.destination_type,
        destinationId: r.destination_id,
        reason: args.reason,
        payloadMeta: { recipeId: r.id, recipeName: r.name },
      })
      created.push(qi.id)
    } else if (r.action_type === 'deliver_webhook_payload') {
      const eventType =
        args.trigger === 'brief_saved'
          ? 'account.brief.generated'
          : args.trigger === 'report_generated'
            ? 'report.generated'
            : 'account.pushed'
      const qi = await createActionQueueItem({
        supabase: args.supabase,
        workspaceId: args.workspaceId,
        userId: args.userId,
        leadId: args.leadId,
        actionType: 'webhook_delivery',
        status: 'ready',
        destinationType: r.destination_type,
        destinationId: r.destination_id,
        reason: args.reason,
        payloadMeta: { recipeId: r.id, recipeName: r.name, eventType, ...(args.triggerMeta ?? {}) },
      })
      created.push(qi.id)
    } else if (r.action_type === 'create_export_job') {
      const qi = await createActionQueueItem({
        supabase: args.supabase,
        workspaceId: args.workspaceId,
        userId: args.userId,
        leadId: args.leadId,
        actionType: 'export_delivery',
        status: 'ready',
        destinationType: r.destination_type,
        destinationId: r.destination_id,
        reason: args.reason,
        payloadMeta: { recipeId: r.id, recipeName: r.name, ...(args.triggerMeta ?? {}) },
      })
      created.push(qi.id)
    } else if (r.action_type === 'require_manual_review') {
      const qi = await createActionQueueItem({
        supabase: args.supabase,
        workspaceId: args.workspaceId,
        userId: args.userId,
        leadId: args.leadId,
        actionType: 'manual_review_required',
        status: 'manual_review',
        destinationType: null,
        destinationId: null,
        reason: args.reason,
        payloadMeta: { recipeId: r.id, recipeName: r.name, ...(args.triggerMeta ?? {}) },
      })
      created.push(qi.id)
    } else if (r.action_type === 'save_queue_item') {
      const qi = await createActionQueueItem({
        supabase: args.supabase,
        workspaceId: args.workspaceId,
        userId: args.userId,
        leadId: args.leadId,
        actionType: 'manual_review_required',
        status: 'ready',
        destinationType: null,
        destinationId: null,
        reason: args.reason,
        payloadMeta: { recipeId: r.id, recipeName: r.name, ...(args.triggerMeta ?? {}) },
      })
      created.push(qi.id)
    }
  }
  return { createdQueueItemIds: created }
}

