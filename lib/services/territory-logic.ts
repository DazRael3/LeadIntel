import type { SupabaseClient } from '@supabase/supabase-js'
import type { TerritoryMatch } from '@/lib/coverage/types'

type RuleRow = {
  id: string
  name: string
  territory_key: string
  priority: number
  match_type: 'domain_suffix' | 'domain_exact' | 'tag'
  match_value: string
  is_enabled: boolean
}

function normDomain(d: string | null): string | null {
  const v = (d ?? '').trim().toLowerCase()
  if (!v) return null
  return v.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? null
}

function matches(rule: RuleRow, args: { domain: string | null; tags: string[] }): boolean {
  const domain = normDomain(args.domain)
  const mv = rule.match_value.trim().toLowerCase()
  if (!mv) return false
  if (rule.match_type === 'domain_exact') return domain === mv
  if (rule.match_type === 'domain_suffix') return domain ? domain === mv || domain.endsWith(`.${mv}`) : false
  return args.tags.map((t) => t.trim().toLowerCase()).includes(mv)
}

export async function resolveTerritoryMatch(args: {
  supabase: SupabaseClient
  workspaceId: string
  accountDomain: string | null
  tags: string[]
}): Promise<TerritoryMatch> {
  const { data } = await args.supabase
    .schema('api')
    .from('territory_rules')
    .select('id, name, territory_key, priority, match_type, match_value, is_enabled')
    .eq('workspace_id', args.workspaceId)
    .eq('is_enabled', true)
    .order('priority', { ascending: true })
    .limit(50)

  const rules = (data ?? []) as unknown as RuleRow[]
  for (const r of rules) {
    if (matches(r, { domain: args.accountDomain, tags: args.tags })) {
      return {
        matched: true,
        territoryKey: r.territory_key,
        ruleName: r.name,
        matchType: r.match_type,
        matchValue: r.match_value,
        note: `Matched territory rule: ${r.name}`,
      }
    }
  }

  return { matched: false, territoryKey: null, ruleName: null, matchType: null, matchValue: null, note: 'No territory match.' }
}

