import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'

export const metadata: Metadata = {
  title: 'Hiring spike outreach playbook | LeadIntel',
  description: 'Use hiring spikes as a “build phase” signal to time outbound before vendors are locked in.',
  openGraph: {
    title: 'Hiring spike outreach playbook | LeadIntel',
    description: 'Use hiring spikes as a “build phase” signal to time outbound before vendors are locked in.',
    url: 'https://dazrael.com/use-cases/hiring-spike',
    images: [
      {
        url: '/api/og?title=Hiring%20spike&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function HiringSpikeUseCasePage() {
  return (
    <MarketingPage title="Hiring spike outreach" subtitle="Catch the build phase before decisions settle.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'hiring_spike' }} />
      <PlaybookTemplate
        title="Hiring spike outreach"
        promise="Use hiring spikes to infer initiative, map ownership, and lead with a focused wedge."
        problemWhyNow={[
          'Hiring spikes are a build signal: new headcount usually maps to a project that needs tooling, process, or enablement.',
          'The window is before the team standardizes on a workflow and before a vendor is embedded.',
        ]}
        lookFor={[
          'Multiple roles posted in the same function (RevOps, Sales Eng, Security, Product)',
          'Job descriptions that mention specific tools, data sources, or processes',
          'A new manager/director hire that implies change (new leader, new playbook)',
          'Headcount added across regions or segments',
          'Language like “build”, “scale”, “standardize”, “roll out”',
          'A new product/market motion paired with hiring',
          'New enablement or process roles (sales enablement, ops, systems)',
          'Evidence of platform migration or tooling consolidation',
        ]}
        angles={[
          { title: 'Initiative mapping', detail: 'Ask what initiative the hiring supports. The best question is easy to answer.' },
          { title: 'Ramp + consistency', detail: 'Hiring breaks messaging. Offer templates + “why now” prioritization to keep output consistent.' },
          { title: 'Ops standardization', detail: 'RevOps hires often signal new reporting/process. Offer a repeatable daily workflow.' },
          { title: 'Tooling gap', detail: 'If the JD names tools, ask what’s working and what’s missing.' },
          { title: 'Owner discovery', detail: 'Use hiring to find the right owner: “is this tied to X initiative?”' },
          { title: 'Short pilot', detail: 'Offer a small pilot: ICP → 10–25 accounts → compare outcomes.' },
        ]}
        templates={{
          cold1: {
            label: 'Cold email #1 (short)',
            body:
              'Subject: Quick question on the hiring push\n\nNoticed you’re hiring for [ROLE].\n\nIs that role tied to [INITIATIVE] or [ALT_INITIATIVE]?\n\nIf yes, I can share a short checklist to turn triggers into daily priorities + a send-ready draft.\n\nWorth 10 minutes?',
          },
          cold2: {
            label: 'Cold email #2 (medium)',
            body:
              'Subject: 1 idea while you’re scaling the team\n\nSaw the hiring spike in [FUNCTION] (especially [ROLE]).\n\nWhen teams scale, the pain usually shows up in one place first: prioritization, enablement, or reporting.\n\nIf you’re working on [INITIATIVE], we can help your reps:\n- get trigger-based account alerts\n- prioritize the day’s list with a 0–100 score\n- generate outreach drafts they can send in minutes\n\nAre you the right owner, or should I ask [ALT_OWNER]?',
          },
          cold3: {
            label: 'Cold email #3 (breakup)',
            body:
              'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf the hiring is unrelated to [INITIATIVE], no problem — I can reach back out later when timing changes.',
          },
          dm1: {
            label: 'LinkedIn DM #1 (ultra short)',
            body: 'Saw you’re hiring for [ROLE] — is that tied to [INITIATIVE]?',
          },
          dm2: {
            label: 'LinkedIn DM #2 (value + question)',
            body:
              'Hiring spikes usually mean a build phase.\n\nIf you’re scaling [FUNCTION], I can share a short checklist for turning triggers into daily priorities + a send-ready draft.\n\nWant it?',
          },
          call1: {
            label: 'Call opener #1',
            body:
              'Hey [NAME] — calling because I noticed the hiring spike in [FUNCTION]. Quick question: is the focus right now [INITIATIVE] or [ALT_INITIATIVE]?',
          },
          call2: {
            label: 'Call opener #2',
            body:
              'Hi [NAME] — when teams hire fast, messaging consistency usually breaks. Are you the owner for enablement/outbound execution, or is that [ALT_OWNER]?',
          },
        }}
        tokens={[
          { token: '[ROLE]', how: 'Use the most specific role (RevOps, Sales Eng, Enablement, Security). Avoid generic titles.' },
          { token: '[FUNCTION]', how: 'The function hiring (GTM, Product, Security, RevOps). Keep it short.' },
          { token: '[INITIATIVE]', how: 'Pick one plausible initiative tied to the role (enablement, reporting, pipeline, compliance).' },
          { token: '[ALT_INITIATIVE]', how: 'A credible alternative so the question is easy to answer.' },
          { token: '[ALT_OWNER]', how: 'Likely owner: RevOps lead, SDR manager, VP Sales, Enablement.' },
          { token: '[NAME]', how: 'First name only.' },
        ]}
        related={[
          { href: '/use-cases/funding-outreach', label: 'Funding outreach' },
          { href: '/use-cases/product-launch-timing', label: 'Product launch' },
          { href: '/use-cases/partnership-announcement', label: 'Partnership announcements' },
        ]}
      />
    </MarketingPage>
  )
}
