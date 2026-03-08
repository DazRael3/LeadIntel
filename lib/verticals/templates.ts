import type { OutreachTemplate } from '@/lib/templates/registry'
import { TEMPLATE_LIBRARY } from '@/lib/templates/registry'
import type { VerticalKey } from './types'

export type VerticalTemplateCuration = {
  vertical: VerticalKey
  label: string
  description: string
  templateSlugs: string[]
}

function safeGetBySlug(slug: string): OutreachTemplate | null {
  return TEMPLATE_LIBRARY.find((t) => t.slug === slug) ?? null
}

function mustHave(slugs: string[]): OutreachTemplate[] {
  const out: OutreachTemplate[] = []
  for (const s of slugs) {
    const t = safeGetBySlug(s)
    if (t) out.push(t)
  }
  return out
}

export const VERTICAL_TEMPLATE_CURATIONS: VerticalTemplateCuration[] = [
  {
    vertical: 'b2b_saas_outbound',
    label: 'B2B SaaS outbound',
    description: 'Timing-first templates that work well with account watchlists and explainable scoring.',
    templateSlugs: [
      'funding-email-1-short',
      'hiring-spike-email-1-short',
      'product-launch-email-1-short',
      'partnership-email-1-short',
      'competitive-displacement-email-1-short',
      'expansion-email-1-short',
      'funding-linkedin-2-value',
      'competitive-displacement-linkedin-2-value',
      'product-launch-call-1-opener',
      'expansion-call-1-opener',
    ],
  },
  {
    vertical: 'gtm_revops_tooling',
    label: 'RevOps / Enablement motions',
    description: 'Enablement-forward templates: consistency, ownership, rollout, and measurable asks.',
    templateSlugs: [
      'hiring-spike-email-2-medium',
      'product-launch-email-2-medium',
      'partnership-email-2-medium',
      'expansion-email-2-medium',
      'competitive-displacement-email-2-medium',
      'hiring-spike-email-followup-1',
      'partnership-email-followup-1',
      'competitive-displacement-email-followup-1',
    ],
  },
  {
    vertical: 'agency_partner_outbound',
    label: 'Agency / partner-led outbound',
    description: 'Reusable templates that keep claims grounded while staying specific.',
    templateSlugs: [
      'funding-email-followup-1',
      'product-launch-email-followup-1',
      'expansion-email-followup-1',
      'partnership-email-followup-1',
      'competitive-displacement-email-followup-1',
      'funding-linkedin-followup',
      'hiring-spike-linkedin-followup',
      'product-launch-linkedin-followup',
    ],
  },
  {
    vertical: 'services_consulting_outbound',
    label: 'Services / consulting outbound',
    description: 'Templates that frame outcomes and next steps without over-claiming industry specifics.',
    templateSlugs: [
      'funding-email-2-medium',
      'product-launch-email-2-medium',
      'expansion-email-2-medium',
      'competitive-displacement-email-2-medium',
      'funding-email-followup-2',
      'competitive-displacement-email-followup-2',
    ],
  },
]

export function getCuratedTemplatesForVertical(vertical: VerticalKey): OutreachTemplate[] {
  const cur = VERTICAL_TEMPLATE_CURATIONS.find((c) => c.vertical === vertical)
  if (!cur) return []
  return mustHave(cur.templateSlugs)
}

