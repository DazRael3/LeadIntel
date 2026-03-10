import { describe, expect, it } from 'vitest'
import { evaluateExperiment } from '@/lib/experiments/engine'
import { defaultWorkspacePolicies } from '@/lib/domain/workspace-policies'
import type { ExperimentDefinition } from '@/lib/experiments/types'

function exp(overrides?: Partial<ExperimentDefinition>): ExperimentDefinition {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    workspaceId: '00000000-0000-0000-0000-000000000002',
    key: 'test_exp',
    name: 'Test',
    hypothesis: null,
    surface: 'dashboard_activation',
    status: 'running',
    rolloutPercent: 50,
    unitType: 'user',
    targeting: {},
    variants: [
      { key: 'control', name: 'Control', weight: 5000 },
      { key: 'direct', name: 'Direct', weight: 5000 },
    ],
    primaryMetrics: ['checklist_step_clicked'],
    secondaryMetrics: [],
    notes: null,
    killSwitch: false,
    createdBy: 'u1',
    updatedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('evaluateExperiment', () => {
  it('returns disabled when experiments are off', () => {
    const policies = defaultWorkspacePolicies()
    const assignment = evaluateExperiment({
      policies,
      experiment: exp(),
      context: {
        userId: 'u1',
        workspaceId: 'w1',
        workspaceRole: 'owner',
        plan: 'team',
        surface: 'dashboard_activation',
        unitType: 'user',
        unitId: 'u1',
      },
      seed: 'seed',
    })
    expect(assignment.source).toBe('disabled')
    expect(assignment.variantKey).toBe('control')
  })

  it('respects kill switch', () => {
    const policies = defaultWorkspacePolicies()
    const enabledPolicies = { ...policies, growth: { ...policies.growth, experimentsEnabled: true } }
    const assignment = evaluateExperiment({
      policies: enabledPolicies,
      experiment: exp({ killSwitch: true }),
      context: {
        userId: 'u1',
        workspaceId: 'w1',
        workspaceRole: 'owner',
        plan: 'team',
        surface: 'dashboard_activation',
        unitType: 'user',
        unitId: 'u1',
      },
      seed: 'seed',
    })
    expect(assignment.source).toBe('disabled')
    expect(assignment.reason).toBe('kill_switch')
  })

  it('blocks protected surfaces', () => {
    const policies = defaultWorkspacePolicies()
    const enabledPolicies = { ...policies, growth: { ...policies.growth, experimentsEnabled: true, protectedSurfaces: ['dashboard_activation'] } }
    const assignment = evaluateExperiment({
      policies: enabledPolicies,
      experiment: exp(),
      context: {
        userId: 'u1',
        workspaceId: 'w1',
        workspaceRole: 'owner',
        plan: 'team',
        surface: 'dashboard_activation',
        unitType: 'user',
        unitId: 'u1',
      },
      seed: 'seed',
    })
    expect(assignment.source).toBe('disabled')
    expect(assignment.reason).toBe('protected_surface')
  })

  it('is deterministic for the same unit', () => {
    const policies = defaultWorkspacePolicies()
    const enabledPolicies = { ...policies, growth: { ...policies.growth, experimentsEnabled: true } }
    const a1 = evaluateExperiment({
      policies: enabledPolicies,
      experiment: exp({ rolloutPercent: 100 }),
      context: {
        userId: 'u1',
        workspaceId: 'w1',
        workspaceRole: 'owner',
        plan: 'team',
        surface: 'dashboard_activation',
        unitType: 'user',
        unitId: 'u1',
      },
      seed: 'seed',
    })
    const a2 = evaluateExperiment({
      policies: enabledPolicies,
      experiment: exp({ rolloutPercent: 100 }),
      context: {
        userId: 'u1',
        workspaceId: 'w1',
        workspaceRole: 'owner',
        plan: 'team',
        surface: 'dashboard_activation',
        unitType: 'user',
        unitId: 'u1',
      },
      seed: 'seed',
    })
    expect(a1.variantKey).toBe(a2.variantKey)
  })
})

