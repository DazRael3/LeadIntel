import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'
import type { ExperimentDefinition, ExperimentContext } from '@/lib/experiments/types'
import { evaluateExperiment } from '@/lib/experiments/engine'
import { flagEnabledFromAssignment } from '@/lib/flags/evaluator'
import type { FlagDefinition, FlagEvaluation } from '@/lib/flags/types'

export function evaluateFlag(args: {
  policies: WorkspacePolicies
  flag: FlagDefinition
  experiment: ExperimentDefinition | null
  context: ExperimentContext
  seed: string
}): FlagEvaluation {
  if (!args.experiment) {
    return { key: args.flag.key, enabled: args.flag.defaultEnabled, source: 'flag_default' }
  }

  const assignment = evaluateExperiment({ policies: args.policies, experiment: args.experiment, context: args.context, seed: args.seed })
  if (assignment.source === 'disabled') {
    return { key: args.flag.key, enabled: args.flag.defaultEnabled, source: 'disabled', assignment }
  }
  return flagEnabledFromAssignment({ flag: args.flag, assignment })
}

