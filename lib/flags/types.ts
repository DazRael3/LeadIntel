import type { ExperimentUnitType, ExperimentContext, ExperimentAssignment } from '@/lib/experiments/types'

export type FlagDefinition = {
  key: string
  surface: string
  unitType: ExperimentUnitType
  defaultEnabled: boolean
  description: string
}

export type FlagContext = Omit<ExperimentContext, 'unitType'> & { unitType: ExperimentUnitType }

export type FlagEvaluation = {
  key: string
  enabled: boolean
  source: 'flag_default' | 'experiment_variant' | 'disabled'
  assignment?: ExperimentAssignment
}

