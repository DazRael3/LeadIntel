import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'

export const metadata: Metadata = {
  title: 'Expansion signals playbook | LeadIntel',
  description: 'Use expansion signals to time outreach around process change and scaling.',
  openGraph: {
    title: 'Expansion signals playbook | LeadIntel',
    description: 'Use expansion signals to time outreach around process change and scaling.',
    url: 'https://dazrael.com/use-cases/expansion-signals',
    images: [
      {
        url: '/api/og?title=Expansion%20signals&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function ExpansionSignalsUseCasePage() {
  return (
    <MarketingPage title="Expansion signals" subtitle="Expansion is when messy processes show up—help standardize early.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'expansion_signals' }} />
      <PlaybookTemplate
        title="Expansion signals"
        promise="Use expansion signals to surface the scaling pain, then offer a small, practical next step."
        problemWhyNow={[
          'Expansion adds complexity: regions, teams, reporting lines, and handoffs get messy fast.',
          'The window is early—before process debt hardens and before teams accept inconsistent execution as “normal”.',
        ]}
        lookFor={[
          'New region/geo launches (EMEA/APAC, new offices)',
          'New segments (SMB → MM, MM → enterprise, vertical push)',
          'Role spikes across regions (AEs, SDRs, CSMs, enablement)',
          'New leadership hires to manage scale (RevOps, Enablement, Sales Ops)',
          'Language about standardization, consolidation, “single source of truth”',
          'New tooling rollouts (CRM changes, analytics, enablement stack)',
          'Process changes: routing, territories, reporting cadence',
          'Customer expansion motion mentioned publicly (upsell/cross-sell focus)',
        ]}
        angles={[
          { title: 'Standardize early', detail: 'Expansion is when consistency matters. Offer templates + prioritization so output doesn’t drift.' },
          { title: 'Handoffs', detail: 'Ask what’s breaking: lead routing, enablement, reporting, onboarding.' },
          { title: 'Territory + targeting', detail: 'Expansion forces new targeting rules. Ask how they pick accounts and sequence.' },
          { title: 'Reporting debt', detail: 'Expansion breaks reporting. Offer a checklist to keep metrics clean.' },
          { title: 'Enablement ramp', detail: 'More reps = faster drift. Offer a daily workflow that keeps outreach consistent.' },
          { title: 'Small working session', detail: 'Offer a 10-minute mapping session to identify the #1 scaling bottleneck.' },
        ]}
        templates={{
          cold1: {
            label: 'Cold email #1 (short)',
            body:
              'Subject: Quick question on expansion\n\nWhen teams expand into [REGION/SEGMENT], the first pain usually shows up in [PAIN] (handoffs/reporting/enablement).\n\nIs that on your radar right now?\n\nIf yes, I can share a short checklist to spot the bottleneck and prioritize fixes.\n\nWorth 10 minutes?',
          },
          cold2: {
            label: 'Cold email #2 (medium)',
            body:
              'Subject: Standardize outbound during expansion\n\nSaw the expansion into [REGION/SEGMENT].\n\nIn growth phases, execution drifts fast: different reps, different messages, inconsistent prioritization.\n\nIf you’re working on [PAIN], we can help your team:\n- spot trigger-based account alerts\n- prioritize the day’s list with a 0–100 score\n- generate outreach drafts you can send in minutes\n\nAre you the right owner, or should I ask [ALT_OWNER]?',
          },
          cold3: {
            label: 'Cold email #3 (breakup)',
            body:
              'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf expansion isn’t a priority right now, no problem — I can reach back out later.',
          },
          dm1: {
            label: 'LinkedIn DM #1 (ultra short)',
            body: 'Expansion into [REGION/SEGMENT] — quick question: what’s the #1 scaling pain right now?',
          },
          dm2: {
            label: 'LinkedIn DM #2 (value + question)',
            body:
              'Expansion usually exposes friction in handoffs/reporting/enablement.\n\nIf helpful, I can share a short checklist to spot the bottleneck and prioritize fixes.\n\nWant it?',
          },
          call1: {
            label: 'Call opener #1',
            body:
              'Hey [NAME] — quick question on the expansion into [REGION/SEGMENT]: what’s the biggest bottleneck right now — handoffs, reporting, or enablement?',
          },
          call2: {
            label: 'Call opener #2',
            body:
              'Hi [NAME] — during expansion, outbound execution often drifts across reps. Are you the owner for enablement/outbound execution, or is that [ALT_OWNER]?',
          },
        }}
        tokens={[
          { token: '[REGION/SEGMENT]', how: 'The region or segment they’re expanding into.' },
          { token: '[PAIN]', how: 'Pick one pain: handoffs, reporting, enablement, onboarding.' },
          { token: '[ALT_OWNER]', how: 'Likely owner: RevOps, Enablement, VP Sales, SDR manager.' },
          { token: '[NAME]', how: 'First name.' },
        ]}
        related={[
          { href: '/use-cases/funding-outreach', label: 'Funding outreach' },
          { href: '/use-cases/hiring-spike', label: 'Hiring spike' },
          { href: '/use-cases/competitive-displacement', label: 'Competitive displacement' },
        ]}
      />
    </MarketingPage>
  )
}
