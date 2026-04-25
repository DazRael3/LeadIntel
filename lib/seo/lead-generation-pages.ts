export type LeadGenerationPageEntry = {
  slug: string
  nicheLabel: string
  headline: string
  description: string
  explanation: string[]
  internalLinks: Array<{ href: string; label: string }>
}

const SHARED_LINKS: Array<{ href: string; label: string }> = [
  { href: '/demo', label: 'Try the demo' },
  { href: '/pricing', label: 'See pricing' },
  { href: '/use-cases', label: 'Explore use cases' },
]

export const LEAD_GENERATION_PAGES: LeadGenerationPageEntry[] = [
  {
    slug: 'real-estate',
    nicheLabel: 'Real Estate',
    headline: 'AI lead generation for real estate teams',
    description: 'Generate qualified property and investor leads with fast outreach drafts.',
    explanation: [
      'Find high-intent property and investor leads based on your ICP and geography.',
      'Generate role-specific outreach messages so reps can personalize quickly.',
      'Prioritize follow-up with fit signals and why-now context.',
    ],
    internalLinks: [...SHARED_LINKS, { href: '/compare', label: 'Compare alternatives' }],
  },
  {
    slug: 'saas',
    nicheLabel: 'SaaS',
    headline: 'AI lead generation for SaaS pipeline growth',
    description: 'Identify active buying signals and launch tailored outbound sequences.',
    explanation: [
      'Uncover target accounts that match your product ICP.',
      'Surface urgency indicators and convert them into outreach talking points.',
      'Move from lead discovery to campaign execution in one workflow.',
    ],
    internalLinks: [...SHARED_LINKS, { href: '/templates', label: 'Browse outbound templates' }],
  },
  {
    slug: 'agencies',
    nicheLabel: 'Agencies',
    headline: 'AI lead generation for agencies closing more retainers',
    description: 'Find clients with active demand and turn signals into win-ready outreach.',
    explanation: [
      'Spot prospects with current growth, hiring, and launch triggers.',
      'Generate outreach copy tailored to agency offers and outcomes.',
      'Maintain momentum with daily refreshes and campaign handoff paths.',
    ],
    internalLinks: [...SHARED_LINKS, { href: '/agency', label: 'Agency workflow overview' }],
  },
]

export const ALL_LEAD_GENERATION_NICHES = LEAD_GENERATION_PAGES

export function toNicheSegment(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

export function getLeadGenerationPageBySlug(slug: string): LeadGenerationPageEntry | null {
  const normalized = toNicheSegment(slug)
  return LEAD_GENERATION_PAGES.find((page) => page.slug === normalized) ?? null
}

export function getLeadGenerationPageByNicheSegment(segment: string): LeadGenerationPageEntry | null {
  const normalized = toNicheSegment(segment)
  return (
    LEAD_GENERATION_PAGES.find((page) => toNicheSegment(page.nicheLabel) === normalized) ??
    getLeadGenerationPageBySlug(normalized)
  )
}
