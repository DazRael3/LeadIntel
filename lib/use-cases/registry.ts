export type UseCaseRegistryItem = {
  slug: string
  href: string
  title: string
  problem: string
  whyNow: string
  templatePreview: string
  tag: string
}

export const USE_CASES: UseCaseRegistryItem[] = [
  {
    slug: 'funding-outreach',
    href: '/use-cases/funding-outreach',
    title: 'Funding outreach',
    problem: 'New capital changes priorities and timelines.',
    whyNow: 'Reach out while budgets and project scopes are being set.',
    templatePreview: '“Congrats on the raise — are you prioritizing X in the next 60 days?”',
    tag: 'Funding',
  },
  {
    slug: 'hiring-spike',
    href: '/use-cases/hiring-spike',
    title: 'Hiring spike outreach',
    problem: 'Hiring often signals growth initiatives or tooling gaps.',
    whyNow: 'Catch the build phase before a vendor is locked in.',
    templatePreview: '“Noticed you’re hiring for Y — is this tied to Z initiative?”',
    tag: 'Hiring',
  },
  {
    slug: 'partnership-announcement',
    href: '/use-cases/partnership-announcement',
    title: 'Partnership announcements',
    problem: 'Partnerships create integration needs and new workflows.',
    whyNow: 'Offer a specific wedge aligned to the announcement.',
    templatePreview: '“Saw the partnership — curious how you’re handling the handoff between A and B?”',
    tag: 'Partnership',
  },
  {
    slug: 'product-launch-timing',
    href: '/use-cases/product-launch-timing',
    title: 'Product launch timing',
    problem: 'Launch cycles increase cross-functional load and tooling demand.',
    whyNow: 'Help remove friction while the team is shipping.',
    templatePreview: '“Congrats on the launch — teams often hit X bottleneck right after GA.”',
    tag: 'Launch',
  },
  {
    slug: 'competitive-displacement',
    href: '/use-cases/competitive-displacement',
    title: 'Competitive displacement',
    problem: 'Competitors change pricing, features, or reliability.',
    whyNow: 'Use a crisp battlecard angle when churn risk is highest.',
    templatePreview: '“If you’re re-evaluating vendor Y, I can share a quick comparison checklist.”',
    tag: 'Battlecard',
  },
  {
    slug: 'expansion-signals',
    href: '/use-cases/expansion-signals',
    title: 'Expansion signals',
    problem: 'Expansion adds complexity: regions, teams, and processes.',
    whyNow: 'Pitch standardization and visibility before the org scales.',
    templatePreview: '“Expansion usually exposes gaps in X — worth a fast audit?”',
    tag: 'Expansion',
  },
]

