import type { AccountExplainability } from '@/lib/data/getAccountExplainability'

export function suggestUseCasePlaybookSlug(explainability: AccountExplainability): string | null {
  const top = explainability.momentum.topSignalTypes?.[0]?.type ?? null
  if (!top) return null
  const t = top.trim().toLowerCase()
  const slug =
    t.includes('fund') ? 'funding-outreach'
    : t.includes('hire') || t.includes('leadership') ? 'hiring-spike'
    : t.includes('product_launch') || t.includes('launch') ? 'product-launch-timing'
    : t.includes('partnership') ? 'partnership-announcement'
    : t.includes('expansion') ? 'expansion-signals'
    : null
  return slug
}

