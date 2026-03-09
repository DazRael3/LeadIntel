export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'

export function isWorkspaceRole(x: unknown): x is WorkspaceRole {
  return x === 'owner' || x === 'admin' || x === 'manager' || x === 'rep' || x === 'viewer'
}

