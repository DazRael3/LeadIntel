import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'

export const metadata: Metadata = {
  title: 'Product launch timing playbook | LeadIntel',
  description: 'Use launch signals to time outreach around high-change periods.',
  openGraph: {
    title: 'Product launch timing playbook | LeadIntel',
    description: 'Use launch signals to time outreach around high-change periods.',
    url: 'https://dazrael.com/use-cases/product-launch-timing',
    images: [
      {
        url: '/api/og?title=Product%20launch%20timing&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function ProductLaunchTimingUseCasePage() {
  return (
    <MarketingPage title="Product launch timing" subtitle="Help teams remove friction when they’re shipping.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'product_launch_timing' }} />
      <PlaybookTemplate
        title="Product launch timing"
        promise="Use launch signals to open with the next bottleneck—then offer a small next step."
        problemWhyNow={[
          'Launch cycles are high-change periods: new GTM motion, new support load, and new internal workflows.',
          'The window is immediately post‑GA, when teams are fixing friction fast and revising messaging.',
        ]}
        lookFor={[
          'GA announcement language: “now available”, “general availability”, “launch”',
          'New docs: onboarding guides, migration notes, pricing pages',
          'Hiring tied to launch: support, enablement, sales engineering',
          'Changelog velocity or multiple release posts close together',
          'New integrations/partnerships announced with the launch',
          'Market repositioning: new segment, enterprise push, new pricing',
          'New security/compliance notes relevant to buyers',
          'Any mention of rollout timeline or phased rollout',
        ]}
        angles={[
          { title: 'Post‑launch bottleneck', detail: 'Ask what broke first: onboarding, pipeline, reporting, support.' },
          { title: 'Enablement drift', detail: 'Launch changes messaging; offer templates + “why now” prioritization to keep reps consistent.' },
          { title: 'Expansion motion', detail: 'If they launched into a segment, ask how they’re prioritizing accounts in that segment.' },
          { title: 'Integration wedge', detail: 'If they launched integrations, anchor on rollout handoffs and reporting.' },
          { title: 'Proof request', detail: 'Ask what success looks like in 30 days and what signals they track.' },
          { title: 'Fast audit', detail: 'Offer a short audit: ICP → target list → why‑now outreach drafts.' },
        ]}
        templates={{
          cold1: {
            label: 'Cold email #1 (short)',
            body:
              'Subject: Quick question post‑launch\n\nCongrats on the launch.\n\nWhat’s the biggest bottleneck in the first 30 days post‑GA — onboarding, reporting, enablement, or support?\n\nIf it’s [BOTTLENECK], I can share a short checklist to reduce friction.\n\nWorth 10 minutes?',
          },
          cold2: {
            label: 'Cold email #2 (medium)',
            body:
              'Subject: 1 idea for the 30 days post‑GA\n\nCongrats on shipping.\n\nAfter GA, teams usually do two things at once: fix friction and scale outbound messaging.\n\nIf you’re working on [BOTTLENECK], we can help your team:\n- spot trigger-based account alerts\n- prioritize the day’s list with a 0–100 score\n- generate outreach drafts you can send in minutes\n\nAre you the owner for this, or should I ask [ALT_OWNER]?',
          },
          cold3: {
            label: 'Cold email #3 (breakup)',
            body:
              'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf post‑launch priorities are elsewhere right now, no problem — I can reach back out later.',
          },
          dm1: {
            label: 'LinkedIn DM #1 (ultra short)',
            body: 'Congrats on the launch — what’s the biggest bottleneck in the 30 days post‑GA?',
          },
          dm2: {
            label: 'LinkedIn DM #2 (value + question)',
            body:
              'Post‑GA, teams usually fix friction + update messaging.\n\nIf you want, I can share a short checklist for [BOTTLENECK] and how teams prioritize the right accounts with “why now” context.\n\nWant it?',
          },
          call1: {
            label: 'Call opener #1',
            body:
              'Hey [NAME] — congrats on the launch. Quick question: what’s the biggest bottleneck you’re fixing first post‑GA — onboarding, reporting, enablement, or support?',
          },
          call2: {
            label: 'Call opener #2',
            body:
              'Hi [NAME] — after GA, messaging often drifts across reps. Are you the owner for enablement/outbound execution, or is that [ALT_OWNER]?',
          },
        }}
        tokens={[
          { token: '[BOTTLENECK]', how: 'Pick one: onboarding, reporting, enablement, support, pipeline.' },
          { token: '[ALT_OWNER]', how: 'Likely owner: Enablement, RevOps, SDR manager, VP Sales, Head of Growth.' },
          { token: '[NAME]', how: 'First name only.' },
        ]}
        related={[
          { href: '/use-cases/partnership-announcement', label: 'Partnership announcements' },
          { href: '/use-cases/hiring-spike', label: 'Hiring spike' },
          { href: '/use-cases/expansion-signals', label: 'Expansion signals' },
        ]}
      />
    </MarketingPage>
  )
}
