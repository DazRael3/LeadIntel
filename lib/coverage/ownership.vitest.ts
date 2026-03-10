import { describe, expect, test } from 'vitest'
import { deriveCoverageState } from '@/lib/coverage/ownership'

describe('coverage ownership', () => {
  test('unowned when no assigned owners', () => {
    const r = deriveCoverageState({ assignedUserIds: [], hasBlocked: false, hasRecentActivity: false, programState: 'standard' })
    expect(r.state).toBe('unowned')
  })

  test('overlap when multiple assigned owners', () => {
    const r = deriveCoverageState({ assignedUserIds: ['a', 'b'], hasBlocked: false, hasRecentActivity: true, programState: 'standard' })
    expect(r.state).toBe('overlapping_ownership')
  })

  test('strategic focus highlights unowned', () => {
    const r = deriveCoverageState({ assignedUserIds: [], hasBlocked: false, hasRecentActivity: true, programState: 'strategic' })
    expect(r.state).toBe('strategic_focus')
  })
})

