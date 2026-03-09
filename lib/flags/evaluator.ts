import type { FlagEvaluation, FlagDefinition } from '@/lib/flags/types'
import type { ExperimentAssignment } from '@/lib/experiments/types'

export function flagEnabledFromAssignment(args: { flag: FlagDefinition; assignment: ExperimentAssignment }): FlagEvaluation {
  // Convention: variantKey 'on' enables the flag; 'control' or 'off' disables.
  const enabled = args.assignment.variantKey === 'on'
  return {
    key: args.flag.key,
    enabled,
    source: 'experiment_variant',
    assignment: args.assignment,
  }
}

