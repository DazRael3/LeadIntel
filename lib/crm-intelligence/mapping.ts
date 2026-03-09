import type { CrmObjectMapping, CrmSystem } from '@/lib/crm-intelligence/types'

export function maskCrmId(id: string): string {
  const v = id.trim()
  if (v.length <= 8) return v
  return `${v.slice(0, 4)}…${v.slice(-4)}`
}

export function mappingDisplayLabel(args: { system: CrmSystem; kind: 'account' | 'opportunity' }): string {
  if (args.system === 'generic') return args.kind === 'account' ? 'CRM account (external)' : 'CRM opportunity (external)'
  return args.kind === 'account' ? 'CRM account' : 'CRM opportunity'
}

export function splitMappings(args: { mappings: CrmObjectMapping[] }): { account: CrmObjectMapping | null; opportunities: CrmObjectMapping[] } {
  const account = args.mappings.find((m) => m.mappingKind === 'account') ?? null
  const opportunities = args.mappings.filter((m) => m.mappingKind === 'opportunity')
  return { account, opportunities }
}

