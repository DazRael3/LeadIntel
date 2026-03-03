import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'

export const metadata: Metadata = {
  title: 'Partnership announcement playbook | LeadIntel',
  description: 'Use partnership announcements as a precise wedge for timely outbound.',
  openGraph: {
    title: 'Partnership announcement playbook | LeadIntel',
    description: 'Use partnership announcements as a precise wedge for timely outbound.',
    url: 'https://dazrael.com/use-cases/partnership-announcement',
    images: [
      {
        url: '/api/og?title=Partnership%20announcements&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function PartnershipAnnouncementUseCasePage() {
  return (
    <MarketingPage title="Partnership announcements" subtitle="Turn announcements into relevant, specific outreach.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'partnership_announcement' }} />
      <PlaybookTemplate
        title="Partnership announcements"
        promise="Use partnership news to lead with rollout friction—not a generic pitch."
        problemWhyNow={[
          'Partnerships create handoffs: data sync, process changes, enablement, reporting, and ownership decisions.',
          'The window is early: teams define how the rollout works before habits and tooling harden.',
        ]}
        lookFor={[
          'Whether the partnership is “announce”, “pilot”, or “GA”',
          'Integration language (API, data sync, workflows, enablement)',
          'New joint offering / co-sell motion mentioned',
          'New requirements: reporting, attribution, security review, SLAs',
          'Cross-team ownership cues (RevOps, Product, Partnerships, Sales Enablement)',
          'New docs, onboarding guides, or migration notes',
          'Customer segment targeted by the partnership',
          'Any mention of timeline (“this quarter”, “next 30 days”)',
        ]}
        angles={[
          { title: 'Rollout stage', detail: 'Ask where they are: announce → pilot → GA. Tailor the next step to the stage.' },
          { title: 'Handoff clarity', detail: 'Lead with “who owns what” and “what breaks” in cross-team rollouts.' },
          { title: 'Reporting + attribution', detail: 'Partnerships often break reporting. Offer a checklist to keep it clean.' },
          { title: 'Enablement drift', detail: 'New motion needs templates + standards. Offer a consistent outreach draft system.' },
          { title: 'Security review', detail: 'If it touches data, ask about security/compliance requirements and owners.' },
          { title: 'Co-sell execution', detail: 'If co-selling, ask about targeting: which accounts get contacted first, and why.' },
        ]}
        templates={{
          cold1: {
            label: 'Cold email #1 (short)',
            body:
              'Subject: Quick question on the partnership rollout\n\nSaw the [PARTNER] announcement — congrats.\n\nAre you already planning how teams will handle [HANDOFF] between [SYSTEM_A] and [SYSTEM_B]?\n\nIf helpful, I can share a short rollout checklist.\n\nWorth 10 minutes?',
          },
          cold2: {
            label: 'Cold email #2 (medium)',
            body:
              'Subject: Prevent rollout friction (partnership)\n\nCongrats on the [PARTNER] announcement.\n\nIn rollouts like this, friction usually shows up in 3 places:\n1) ownership (who does what)\n2) reporting (what gets measured)\n3) enablement (how reps message it)\n\nIf you’re in [STAGE] (pilot/GA), we can help your team prioritize accounts and generate a “why now” draft you can send fast.\n\nAre you the right owner, or should I ask [ALT_OWNER]?',
          },
          cold3: {
            label: 'Cold email #3 (breakup)',
            body:
              'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf the partnership rollout isn’t a focus right now, no problem — I can reach back out later.',
          },
          dm1: {
            label: 'LinkedIn DM #1 (ultra short)',
            body: 'Congrats on the [PARTNER] announcement — are you in pilot or GA right now?',
          },
          dm2: {
            label: 'LinkedIn DM #2 (value + question)',
            body:
              'Partnership rollouts usually break handoffs + reporting.\n\nIf you want, I can share a short rollout checklist and how teams prioritize the right accounts during the rollout.\n\nWant it?',
          },
          call1: {
            label: 'Call opener #1',
            body:
              'Hey [NAME] — quick question on the [PARTNER] rollout: are you in pilot or GA, and who owns the [HANDOFF] between [SYSTEM_A] and [SYSTEM_B]?',
          },
          call2: {
            label: 'Call opener #2',
            body:
              'Hi [NAME] — partnerships often create enablement drift. Are you the owner for messaging/templates, or is that [ALT_OWNER]?',
          },
        }}
        tokens={[
          { token: '[PARTNER]', how: 'The partner name from the announcement.' },
          { token: '[STAGE]', how: 'Pilot vs GA. If unknown, ask as the first question.' },
          { token: '[HANDOFF]', how: 'One concrete handoff: lead routing, reporting, onboarding, enablement.' },
          { token: '[SYSTEM_A]', how: 'The system/process on one side of the handoff.' },
          { token: '[SYSTEM_B]', how: 'The system/process on the other side.' },
          { token: '[ALT_OWNER]', how: 'Likely owner: Partnerships lead, RevOps, Enablement, Product.' },
          { token: '[NAME]', how: 'First name.' },
        ]}
        related={[
          { href: '/use-cases/product-launch-timing', label: 'Product launch' },
          { href: '/use-cases/expansion-signals', label: 'Expansion signals' },
          { href: '/use-cases/competitive-displacement', label: 'Competitive displacement' },
        ]}
      />
    </MarketingPage>
  )
}
