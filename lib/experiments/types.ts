import { z } from 'zod'
import type { WorkspaceRole } from '@/lib/team/workspace'

export const ExperimentStatusSchema = z.enum([
  'draft',
  'running',
  'paused',
  'completed',
  'archived',
  'rolled_out',
  'reverted',
])
export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>

export const ExperimentUnitTypeSchema = z.enum(['user', 'workspace', 'session'])
export type ExperimentUnitType = z.infer<typeof ExperimentUnitTypeSchema>

export type ExperimentVariant = {
  key: string
  name: string
  weight: number
}

export type ExperimentTargeting = {
  roles?: WorkspaceRole[]
  plans?: string[]
  includeUserIds?: string[]
  excludeUserIds?: string[]
}

export type ExperimentDefinition = {
  id: string
  workspaceId: string
  key: string
  name: string
  hypothesis: string | null
  surface: string
  status: ExperimentStatus
  rolloutPercent: number
  unitType: ExperimentUnitType
  targeting: ExperimentTargeting
  variants: ExperimentVariant[]
  primaryMetrics: string[]
  secondaryMetrics: string[]
  notes: string | null
  killSwitch: boolean
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type ExperimentContext = {
  userId: string
  workspaceId: string
  workspaceRole: WorkspaceRole
  plan: string | null
  surface: string
  unitType: ExperimentUnitType
  unitId: string
  nowIso?: string
}

export type ExperimentAssignment = {
  experimentKey: string
  variantKey: string
  source: 'experiment' | 'fallback' | 'disabled'
  reason:
    | 'experiments_disabled'
    | 'kill_switch'
    | 'not_running'
    | 'rollout_0'
    | 'rollout_bucket_out'
    | 'targeting_mismatch'
    | 'surface_not_allowed'
    | 'protected_surface'
    | 'assigned'
    | 'invalid_definition'
}

