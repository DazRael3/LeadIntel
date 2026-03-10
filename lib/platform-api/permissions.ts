import type { PlatformScope } from '@/lib/platform-api/types'

export function hasScope(args: { scopes: PlatformScope[]; required: PlatformScope | PlatformScope[] }): boolean {
  const set = new Set<PlatformScope>(args.scopes ?? [])
  if (Array.isArray(args.required)) return args.required.every((s) => set.has(s))
  return set.has(args.required)
}

