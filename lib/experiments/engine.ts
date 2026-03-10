import { fallbackVariantKey } from '@/lib/experiments/fallbacks'
import { stableBucket, inRollout, pickVariant } from '@/lib/experiments/assignment'
import { matchesTargeting } from '@/lib/experiments/targeting'
import { experimentsGloballyEnabled, isSurfaceAllowed, isSurfaceProtected } from '@/lib/experiments/guards'
import { ExperimentTargetingSchema, ExperimentVariantSchema } from '@/lib/experiments/schema'
import type { ExperimentAssignment, ExperimentContext, ExperimentDefinition, ExperimentTargeting, ExperimentVariant } from '@/lib/experiments/types'
import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'

function safeParseTargeting(value: unknown): ExperimentTargeting {
  const parsed = ExperimentTargetingSchema.safeParse(value)
  if (!parsed.success) return {}
  return parsed.data
}

function safeParseVariants(value: unknown): ExperimentVariant[] {
  if (!Array.isArray(value)) return []
  const out: ExperimentVariant[] = []
  for (const v of value) {
    const parsed = ExperimentVariantSchema.safeParse(v)
    if (!parsed.success) continue
    out.push(parsed.data)
  }
  return out
}

export function evaluateExperiment(args: {
  policies: WorkspacePolicies
  experiment: ExperimentDefinition
  context: ExperimentContext
  seed: string
}): ExperimentAssignment {
  const fallback = fallbackVariantKey()

  if (!experimentsGloballyEnabled(args.policies)) {
    return { experimentKey: args.experiment.key, variantKey: fallback, source: 'disabled', reason: 'experiments_disabled' }
  }

  if (!isSurfaceAllowed(args.context.surface)) {
    return { experimentKey: args.experiment.key, variantKey: fallback, source: 'disabled', reason: 'surface_not_allowed' }
  }

  if (isSurfaceProtected({ policies: args.policies, surface: args.context.surface })) {
    return { experimentKey: args.experiment.key, variantKey: fallback, source: 'disabled', reason: 'protected_surface' }
  }

  if (args.experiment.killSwitch) {
    return { experimentKey: args.experiment.key, variantKey: fallback, source: 'disabled', reason: 'kill_switch' }
  }

  if (args.experiment.status !== 'running') {
    return { experimentKey: args.experiment.key, variantKey: fallback, source: 'fallback', reason: 'not_running' }
  }

  if (args.experiment.rolloutPercent <= 0) {
    return { experimentKey: args.experiment.key, variantKey: fallback, source: 'fallback', reason: 'rollout_0' }
  }

  const targeting = safeParseTargeting(args.experiment.targeting as unknown)
  if (
    !matchesTargeting({
      targeting,
      workspaceRole: args.context.workspaceRole,
      plan: args.context.plan,
      userId: args.context.userId,
    })
  ) {
    return { experimentKey: args.experiment.key, variantKey: fallback, source: 'fallback', reason: 'targeting_mismatch' }
  }

  const variants = safeParseVariants(args.experiment.variants as unknown)
  if (variants.length === 0) {
    return { experimentKey: args.experiment.key, variantKey: fallback, source: 'fallback', reason: 'invalid_definition' }
  }

  const bucket = stableBucket({ seed: args.seed, key: args.experiment.key, unitId: args.context.unitId })
  if (!inRollout({ bucket, rolloutPercent: args.experiment.rolloutPercent })) {
    return { experimentKey: args.experiment.key, variantKey: fallback, source: 'fallback', reason: 'rollout_bucket_out' }
  }

  const picked = pickVariant({ bucket, variants })
  if (!picked) {
    return { experimentKey: args.experiment.key, variantKey: fallback, source: 'fallback', reason: 'invalid_definition' }
  }

  return { experimentKey: args.experiment.key, variantKey: picked, source: 'experiment', reason: 'assigned' }
}

