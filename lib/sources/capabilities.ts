import type { SourceCapability, SourceDefinition } from '@/lib/sources/types'

export function sourceHasCapability(source: SourceDefinition, cap: SourceCapability): boolean {
  return source.capabilities.includes(cap)
}

