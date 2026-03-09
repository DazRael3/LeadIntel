import { describe, expect, it } from 'vitest'
import { WorkspacePoliciesSchema } from '@/lib/domain/workspace-policies'

describe('WorkspacePoliciesSchema reporting defaults', () => {
  it('includes reporting block with safe defaults', () => {
    const p = WorkspacePoliciesSchema.parse({})
    expect(p.reporting.executiveEnabled).toBe(true)
    expect(p.reporting.commandCenterEnabled).toBe(true)
    expect(p.reporting.snapshotsEnabled).toBe(true)
    expect(p.reporting.executiveViewerRoles).toEqual(['owner', 'admin', 'manager'])
    expect(p.reporting.commandViewerRoles).toEqual(['owner', 'admin', 'manager'])
    expect(p.reporting.mobileQuickActionsEnabled).toBe(true)
  })
})

