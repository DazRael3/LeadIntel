import type { CoverageState } from '@/lib/coverage/types'

export type CoverageOwnershipInputs = {
  assignedUserIds: string[]
  hasBlocked: boolean
  hasRecentActivity: boolean
  programState: 'strategic' | 'named' | 'expansion_watch' | 'monitor' | 'standard'
}

export function deriveCoverageState(i: CoverageOwnershipInputs): { state: CoverageState; reason: string; nextAction: string } {
  if (i.hasBlocked) {
    return { state: 'blocked', reason: 'Workflow is blocked or failed.', nextAction: 'Resolve blockers or rerun delivery.' }
  }

  if (i.programState === 'strategic') {
    if (i.assignedUserIds.length === 0) return { state: 'strategic_focus', reason: 'Strategic account is unowned.', nextAction: 'Assign an owner and set a weekly review cadence.' }
    if (!i.hasRecentActivity) return { state: 'owned_but_stale', reason: 'Strategic account lacks recent follow-through.', nextAction: 'Review signals and execute the next planned step.' }
    return { state: 'owned_and_active', reason: 'Strategic account has active coverage.', nextAction: 'Continue follow-through while timing is fresh.' }
  }

  if (i.programState === 'expansion_watch') {
    if (i.assignedUserIds.length === 0) return { state: 'expansion_watch', reason: 'Expansion watch is unowned.', nextAction: 'Assign an owner to validate expansion context.' }
    if (!i.hasRecentActivity) return { state: 'owned_but_stale', reason: 'Expansion watch is stale.', nextAction: 'Re-check timing and run a lightweight follow-up motion.' }
    return { state: 'expansion_watch', reason: 'Expansion watch has active coverage.', nextAction: 'Run a two-touch expansion motion (bounded) and record outcome.' }
  }

  if (i.programState === 'monitor') {
    return { state: 'monitor_only', reason: 'Account is monitor-only.', nextAction: 'Wait for a stronger signal before investing deeper time.' }
  }

  if (i.assignedUserIds.length === 0) {
    return { state: 'unowned', reason: 'No owner assigned in the workspace workflow.', nextAction: 'Assign an owner or route via territory rules.' }
  }

  if (i.assignedUserIds.length > 1) {
    return { state: 'overlapping_ownership', reason: 'Multiple owners are assigned.', nextAction: 'Resolve ownership overlap to avoid duplicate outreach.' }
  }

  if (!i.hasRecentActivity) {
    return { state: 'owned_but_stale', reason: 'Owned but no recent follow-through observed.', nextAction: 'Execute the next best action or mark as monitor.' }
  }

  return { state: 'owned_and_active', reason: 'Owned and actively worked.', nextAction: 'Continue follow-through and track outcome.' }
}

