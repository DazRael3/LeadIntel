import type { SupabaseClient } from '@supabase/supabase-js'
import { CreateExperimentSchema, ExperimentRowSchema, UpdateExperimentSchema } from '@/lib/experiments/schema'
import { ExperimentTargetingSchema, ExperimentVariantSchema } from '@/lib/experiments/schema'
import type { ExperimentDefinition, ExperimentStatus, ExperimentTargeting, ExperimentVariant } from '@/lib/experiments/types'

type DbExperimentRow = {
  id: string
  workspace_id: string
  key: string
  name: string
  hypothesis: string | null
  surface: string
  status: ExperimentStatus
  rollout_percent: number
  unit_type: 'user' | 'workspace' | 'session'
  targeting: unknown
  variants: unknown
  primary_metrics: string[] | null
  secondary_metrics: string[] | null
  notes: string | null
  kill_switch: boolean
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

function toExperiment(row: DbExperimentRow): ExperimentDefinition {
  const targetingParsed = ExperimentTargetingSchema.safeParse(row.targeting)
  const targeting: ExperimentTargeting = targetingParsed.success ? targetingParsed.data : {}

  const variants: ExperimentVariant[] = []
  if (Array.isArray(row.variants)) {
    for (const v of row.variants) {
      const parsed = ExperimentVariantSchema.safeParse(v)
      if (parsed.success) variants.push(parsed.data)
    }
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    key: row.key,
    name: row.name,
    hypothesis: row.hypothesis ?? null,
    surface: row.surface,
    status: row.status,
    rolloutPercent: row.rollout_percent,
    unitType: row.unit_type,
    targeting,
    variants,
    primaryMetrics: row.primary_metrics ?? [],
    secondaryMetrics: row.secondary_metrics ?? [],
    notes: row.notes ?? null,
    killSwitch: row.kill_switch ?? false,
    createdBy: row.created_by,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listExperiments(args: { supabase: SupabaseClient; workspaceId: string }): Promise<ExperimentDefinition[]> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('experiments')
    .select(
      'id, workspace_id, key, name, hypothesis, surface, status, rollout_percent, unit_type, targeting, variants, primary_metrics, secondary_metrics, notes, kill_switch, created_by, updated_by, created_at, updated_at'
    )
    .eq('workspace_id', args.workspaceId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error('experiments_list_failed')
  const out: ExperimentDefinition[] = []
  for (const raw of (data ?? []) as unknown[]) {
    const parsed = ExperimentRowSchema.safeParse(raw)
    if (!parsed.success) continue
    out.push(toExperiment(parsed.data as unknown as DbExperimentRow))
  }
  return out
}

export async function getExperiment(args: { supabase: SupabaseClient; workspaceId: string; experimentId: string }): Promise<ExperimentDefinition | null> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('experiments')
    .select(
      'id, workspace_id, key, name, hypothesis, surface, status, rollout_percent, unit_type, targeting, variants, primary_metrics, secondary_metrics, notes, kill_switch, created_by, updated_by, created_at, updated_at'
    )
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.experimentId)
    .maybeSingle()

  if (error) throw new Error('experiments_get_failed')
  if (!data) return null
  const parsed = ExperimentRowSchema.safeParse(data)
  if (!parsed.success) return null
  return toExperiment(parsed.data as unknown as DbExperimentRow)
}

export async function createExperiment(args: {
  supabase: SupabaseClient
  workspaceId: string
  actorUserId: string
  input: unknown
}): Promise<ExperimentDefinition> {
  const parsed = CreateExperimentSchema.parse(args.input)
  const { data, error } = await args.supabase
    .schema('api')
    .from('experiments')
    .insert({
      workspace_id: args.workspaceId,
      key: parsed.key,
      name: parsed.name,
      hypothesis: parsed.hypothesis ?? null,
      surface: parsed.surface,
      status: 'draft',
      rollout_percent: parsed.rolloutPercent,
      unit_type: parsed.unitType,
      targeting: parsed.targeting,
      variants: parsed.variants,
      primary_metrics: parsed.primaryMetrics,
      secondary_metrics: parsed.secondaryMetrics,
      notes: parsed.notes ?? null,
      kill_switch: false,
      created_by: args.actorUserId,
      updated_by: args.actorUserId,
    })
    .select(
      'id, workspace_id, key, name, hypothesis, surface, status, rollout_percent, unit_type, targeting, variants, primary_metrics, secondary_metrics, notes, kill_switch, created_by, updated_by, created_at, updated_at'
    )
    .single()

  if (error || !data) throw new Error('experiments_create_failed')
  const row = ExperimentRowSchema.parse(data) as unknown as DbExperimentRow
  return toExperiment(row)
}

export async function updateExperiment(args: {
  supabase: SupabaseClient
  workspaceId: string
  actorUserId: string
  experimentId: string
  patch: unknown
}): Promise<ExperimentDefinition> {
  const parsed = UpdateExperimentSchema.parse(args.patch)
  const update: Record<string, unknown> = {
    updated_by: args.actorUserId,
  }
  if (parsed.key !== undefined) update.key = parsed.key
  if (parsed.name !== undefined) update.name = parsed.name
  if (parsed.hypothesis !== undefined) update.hypothesis = parsed.hypothesis ?? null
  if (parsed.surface !== undefined) update.surface = parsed.surface
  if (parsed.rolloutPercent !== undefined) update.rollout_percent = parsed.rolloutPercent
  if (parsed.unitType !== undefined) update.unit_type = parsed.unitType
  if (parsed.targeting !== undefined) update.targeting = parsed.targeting
  if (parsed.variants !== undefined) update.variants = parsed.variants
  if (parsed.primaryMetrics !== undefined) update.primary_metrics = parsed.primaryMetrics
  if (parsed.secondaryMetrics !== undefined) update.secondary_metrics = parsed.secondaryMetrics
  if (parsed.notes !== undefined) update.notes = parsed.notes ?? null
  if (parsed.status !== undefined) update.status = parsed.status
  if (parsed.killSwitch !== undefined) update.kill_switch = parsed.killSwitch

  const { data, error } = await args.supabase
    .schema('api')
    .from('experiments')
    .update(update)
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.experimentId)
    .select(
      'id, workspace_id, key, name, hypothesis, surface, status, rollout_percent, unit_type, targeting, variants, primary_metrics, secondary_metrics, notes, kill_switch, created_by, updated_by, created_at, updated_at'
    )
    .single()

  if (error || !data) throw new Error('experiments_update_failed')
  const row = ExperimentRowSchema.parse(data) as unknown as DbExperimentRow
  return toExperiment(row)
}

