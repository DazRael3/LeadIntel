import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'

export const metadata: Metadata = {
  title: 'Funding outreach playbook | LeadIntel',
  description: 'Turn fresh funding signals into timely outreach with a clear “why now” angle.',
  openGraph: {
    title: 'Funding outreach playbook | LeadIntel',
    description: 'Turn fresh funding signals into timely outreach with a clear “why now” angle.',
    url: 'https://dazrael.com/use-cases/funding-outreach',
    images: [
      {
        url: '/api/og?title=Funding%20outreach&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function FundingOutreachUseCasePage() {
  return (
    <MarketingPage title="Funding outreach" subtitle="Reach the account while budgets and initiatives are being set.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'funding_outreach' }} />
      <PlaybookTemplate
        title="Funding outreach"
        promise="Turn fresh funding signals into a tight “why now” message and a small next step."
        problemWhyNow={[
          'Funding compresses timelines: targets change, teams expand, and projects get greenlit quickly.',
          'The window is early—before a shortlist forms and internal owners are locked into a plan.',
        ]}
        lookFor={[
          'Round type + approximate timing (“new round”, “extended runway”)',
          'Role spikes in RevOps / Sales Ops / GTM / Security',
          'New leadership hires tied to execution (CRO, VP RevOps, Head of Growth)',
          'Language about expansion (new segments, new geo, enterprise push)',
          'Mentions of rebuilding pipeline, enablement, or forecasting',
          'Evidence of tool consolidation or new systems build',
          'New partnerships/integrations announced alongside the raise',
          'Job descriptions that reference your category (signals of evaluation)',
        ]}
        angles={[
          { title: 'Execution gap', detail: '“Congrats on the raise—what’s the #1 execution bottleneck you’re fixing first?”' },
          { title: 'Pipeline math', detail: 'Anchor on coverage and speed: prioritization + templates that reduce time-to-meeting.' },
          { title: 'Enablement ramp', detail: 'Hiring + new targets usually break messaging consistency. Offer a fast template system.' },
          { title: 'RevOps build', detail: 'If they’re adding ops roles, ask what system they’re standardizing next.' },
          { title: 'Segment expansion', detail: 'Tie to the segment they’re moving into—offer a signal-based account list approach.' },
          { title: 'Vendor shortlist', detail: 'Ask where they are: research vs shortlist vs pilot. Offer a one-page checklist.' },
        ]}
        templates={{
          cold1: {
            label: 'Cold email #1 (short)',
            body:
              'Subject: Quick question post‑funding\n\nCongrats on the raise — are you prioritizing [INITIATIVE] in the next 60 days?\n\nIf yes, I can share a short checklist to turn “why now” signals into daily priorities + a send-ready draft.\n\nWorth a quick 10 minutes?',
          },
          cold2: {
            label: 'Cold email #2 (medium)',
            body:
              'Subject: 1 idea for the first 30 days after funding\n\nCongrats on the funding.\n\nIn the first 30 days, teams usually pick 1–2 execution projects (pipeline coverage, enablement, tooling, reporting).\n\nIf [INITIATIVE] is on the roadmap, we can help your team:\n- spot trigger-based account alerts\n- prioritize the day’s list with a 0–100 score\n- draft outreach you can send in minutes\n\nAre you the right owner for this, or should I ask [ALT_OWNER]?',
          },
          cold3: {
            label: 'Cold email #3 (breakup)',
            body:
              'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf [INITIATIVE] isn’t a priority post‑funding, no problem — I can reach back out later when timing changes.',
          },
          dm1: {
            label: 'LinkedIn DM #1 (ultra short)',
            body:
              'Congrats on the funding — quick question: is the priority this quarter [INITIATIVE] or [ALT_INITIATIVE]?',
          },
          dm2: {
            label: 'LinkedIn DM #2 (value + question)',
            body:
              'Congrats on the raise.\n\nIf you’re tackling [INITIATIVE], I can share a short checklist for turning triggers into a daily shortlist + a send-ready draft.\n\nWant it?',
          },
          call1: {
            label: 'Call opener #1',
            body:
              'Hey [NAME] — congrats on the funding. Quick question: what initiative is highest priority in the next 60 days — pipeline, enablement, or ops tooling? I’ll tailor this to that.',
          },
          call2: {
            label: 'Call opener #2',
            body:
              'Hi [NAME] — calling because post‑funding teams often move fast and messaging gets inconsistent. Are you the owner for outbound execution, or is that [ALT_OWNER]?',
          },
        }}
        tokens={[
          { token: '[INITIATIVE]', how: 'Pick one: pipeline coverage, enablement, revops tooling, security/compliance, expansion.' },
          { token: '[ALT_INITIATIVE]', how: 'A credible alternative so the question is easy to answer.' },
          { token: '[ALT_OWNER]', how: 'Likely owner: RevOps lead, SDR manager, VP Sales, or Head of Growth.' },
          { token: '[NAME]', how: 'Use first name only; avoid over-personalizing.' },
        ]}
        related={[
          { href: '/use-cases/hiring-spike', label: 'Hiring spike' },
          { href: '/use-cases/expansion-signals', label: 'Expansion signals' },
          { href: '/use-cases/competitive-displacement', label: 'Competitive displacement' },
        ]}
      />
    </MarketingPage>
  )
}
