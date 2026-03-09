import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'
import { isAllowedSurface } from '@/lib/experiments/registry'

export function experimentsGloballyEnabled(policies: WorkspacePolicies): boolean {
  return policies.growth.experimentsEnabled === true
}

export function exposureLoggingEnabled(policies: WorkspacePolicies): boolean {
  return policies.growth.exposureLoggingEnabled === true
}

export function isSurfaceProtected(args: { policies: WorkspacePolicies; surface: string }): boolean {
  const s = args.surface.trim().toLowerCase()
  const protectedKeys = (args.policies.growth.protectedSurfaces ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean)
  if (protectedKeys.includes(s)) return true
  return false
}

export function isSurfaceAllowed(surface: string): boolean {
  return isAllowedSurface(surface)
}

