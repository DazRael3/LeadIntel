import { z } from 'zod'
import { ExperimentStatusSchema, ExperimentUnitTypeSchema } from '@/lib/experiments/types'
import { WorkspaceRoleSchema } from '@/lib/domain/workspace-policies'
import { isAllowedSurface } from '@/lib/experiments/registry'

export const ExperimentVariantSchema = z.object({
  key: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(128),
  weight: z.number().int().min(0).max(10000),
})

export const ExperimentTargetingSchema = z.object({
  roles: z.array(WorkspaceRoleSchema).min(1).optional(),
  plans: z.array(z.string().trim().min(1).max(64)).min(1).optional(),
  includeUserIds: z.array(z.string().trim().min(1).max(64)).min(1).optional(),
  excludeUserIds: z.array(z.string().trim().min(1).max(64)).min(1).optional(),
})

export const ExperimentRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  hypothesis: z.string().nullable().optional(),
  surface: z.string(),
  status: ExperimentStatusSchema,
  rollout_percent: z.number().int(),
  unit_type: ExperimentUnitTypeSchema,
  targeting: z.unknown(),
  variants: z.unknown(),
  primary_metrics: z.array(z.string()).optional(),
  secondary_metrics: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  kill_switch: z.boolean().optional(),
  created_by: z.string(),
  updated_by: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const CreateExperimentSchema = z.object({
  key: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(128),
  hypothesis: z.string().trim().min(1).max(2000).nullable().optional(),
  surface: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((v) => isAllowedSurface(v), { message: 'Unsupported surface' }),
  rolloutPercent: z.number().int().min(0).max(100).default(0),
  unitType: ExperimentUnitTypeSchema.default('user'),
  targeting: ExperimentTargetingSchema.default({}),
  variants: z
    .array(ExperimentVariantSchema)
    .min(1)
    .default([{ key: 'control', name: 'Control', weight: 10000 }]),
  primaryMetrics: z.array(z.string().trim().min(1).max(64)).min(1),
  secondaryMetrics: z.array(z.string().trim().min(1).max(64)).default([]),
  notes: z.string().trim().min(1).max(4000).nullable().optional(),
})

export const UpdateExperimentSchema = CreateExperimentSchema.partial().extend({
  status: ExperimentStatusSchema.optional(),
  killSwitch: z.boolean().optional(),
})

