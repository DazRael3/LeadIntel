import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'

export const metadata: Metadata = {
  title: 'Competitive displacement playbook | LeadIntel',
  description: 'Use battlecard-style angles when an account is evaluating alternatives.',
  openGraph: {
    title: 'Competitive displacement playbook | LeadIntel',
    description: 'Use battlecard-style angles when an account is evaluating alternatives.',
    url: 'https://dazrael.com/use-cases/competitive-displacement',
    images: [
      {
        url: '/api/og?title=Competitive%20displacement&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function CompetitiveDisplacementUseCasePage() {
  return (
    <MarketingPage title="Competitive displacement" subtitle="A crisp POV and checklist beats generic comparison claims.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'competitive_displacement' }} />
      <PlaybookTemplate
        title="Competitive displacement"
        promise="Help buyers compare options fast with a clean checklist and a calm POV."
        problemWhyNow={[
          'Displacement is usually a messy evaluation: requirements are unclear, risks are hidden, and timelines slip.',
          'The window is when the account is moving from research → shortlist → pilot and wants structure.',
        ]}
        lookFor={[
          'Signals of dissatisfaction (role churn, “rebuild”, “consolidate”, “migration”)',
          'New decision-maker or new owner of the workflow',
          'Mentions of “vendor review”, “renewal”, “tool consolidation”',
          'Security/legal review language (risk is part of the decision)',
          'A new initiative that changes requirements (new segment, new geo)',
          'Budget timing (renewal window, fiscal planning)',
          'Process gaps mentioned publicly (reporting, handoffs, enablement)',
          'Any “RFP / shortlist / pilot” wording',
        ]}
        angles={[
          { title: 'Decision checklist', detail: 'Lead with 3–5 decision points: requirements, rollout risk, reporting, maintenance.' },
          { title: 'Timeline control', detail: 'Offer a 10-minute “what to decide first” working session.' },
          { title: 'Risk reduction', detail: 'Ask what would make the project fail (adoption, data quality, ownership).' },
          { title: 'Status quo cost', detail: 'Frame the cost of waiting: manual work, inconsistency, missed timing windows.' },
          { title: 'Pilot design', detail: 'Offer a small pilot plan with clear success criteria.' },
          { title: 'Owner mapping', detail: 'Ask who owns evaluation: RevOps, Enablement, Sales, Security.' },
        ]}
        templates={{
          cold1: {
            label: 'Cold email #1 (short)',
            body:
              'Subject: Quick evaluation checklist\n\nIf you’re evaluating alternatives to [VENDOR], here’s a simple checklist to decide fast:\n1) must-have requirements\n2) rollout + adoption risk\n3) reporting + maintenance\n\nWant the 1‑page version?',
          },
          cold2: {
            label: 'Cold email #2 (medium)',
            body:
              'Subject: Shortlist → pilot decision points\n\nIf you’re moving from research → shortlist → pilot for [WORKFLOW], the fastest path is to agree on:\n- what “good” looks like (success criteria)\n- rollout risk (who adopts + how)\n- reporting/maintenance (what breaks over time)\n\nIf you want, I can share a 1‑page battlecard-style checklist and a pilot plan.\n\nAre you the right owner, or should I ask [ALT_OWNER]?',
          },
          cold3: {
            label: 'Cold email #3 (breakup)',
            body:
              'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf you’re not evaluating alternatives to [VENDOR] right now, no problem — I can reach back out later.',
          },
          dm1: {
            label: 'LinkedIn DM #1 (ultra short)',
            body: 'If you’re evaluating alternatives to [VENDOR], want a 1‑page decision checklist?',
          },
          dm2: {
            label: 'LinkedIn DM #2 (value + question)',
            body:
              'When teams displace a vendor, timelines slip because requirements and rollout risk aren’t pinned down.\n\nIf helpful, I can share a short checklist + pilot plan.\n\nWant it?',
          },
          call1: {
            label: 'Call opener #1',
            body:
              'Hey [NAME] — quick question: are you in research, shortlist, or pilot for [WORKFLOW]? I’ll keep this tight.',
          },
          call2: {
            label: 'Call opener #2',
            body:
              'Hi [NAME] — when teams displace a vendor, the decision usually hinges on rollout risk and reporting. Who owns evaluation on your side — you or [ALT_OWNER]?',
          },
        }}
        tokens={[
          { token: '[VENDOR]', how: 'The incumbent vendor or category. Keep it factual; avoid trash-talking.' },
          { token: '[WORKFLOW]', how: 'The workflow being evaluated (e.g., outbound prioritization, enablement, reporting).' },
          { token: '[ALT_OWNER]', how: 'Likely owner: RevOps, Enablement, VP Sales, Security.' },
          { token: '[NAME]', how: 'First name.' },
        ]}
        related={[
          { href: '/use-cases/funding-outreach', label: 'Funding outreach' },
          { href: '/use-cases/expansion-signals', label: 'Expansion signals' },
          { href: '/use-cases/product-launch-timing', label: 'Product launch' },
        ]}
      />
    </MarketingPage>
  )
}
