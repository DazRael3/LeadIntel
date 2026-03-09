import type { ExperimentAssignment, ExperimentContext } from '@/lib/experiments/types'

export function exposureDedupeKey(args: { experimentKey: string; unitType: string; unitId: string }): string {
  // Keep stable + short for DB unique index and safe logs.
  const key = `${args.experimentKey}:${args.unitType}:${args.unitId}`
  return key.length <= 128 ? key : key.slice(0, 128)
}

export function exposureEventProps(args: { assignment: ExperimentAssignment; context: ExperimentContext }): Record<string, unknown> {
  return {
    experimentKey: args.assignment.experimentKey,
    variantKey: args.assignment.variantKey,
    surface: args.context.surface,
    unitType: args.context.unitType,
    // Never include premium content; unitId/userId are internal identifiers.
    workspaceId: args.context.workspaceId,
    source: args.assignment.source,
    reason: args.assignment.reason,
  }
}

