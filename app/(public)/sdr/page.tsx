import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PersonaTemplate } from '@/components/marketing/PersonaTemplate'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'For SDRs | LeadIntel',
  description: 'Daily “why now” signals and ready-to-send outreach for high-volume prospecting.',
  alternates: { canonical: 'https://raelinfo.com/sdr' },
  openGraph: {
    title: 'For SDRs | LeadIntel',
    description: 'Daily “why now” signals and ready-to-send outreach for high-volume prospecting.',
    url: 'https://raelinfo.com/sdr',
  },
}

export default function SdrPage() {
  return (
    <MarketingPage title="For SDRs" subtitle="Turn signals into booked meetings without spending mornings on research.">
      <PageViewTrack event="persona_view" props={{ persona: 'sdr' }} />
      <PersonaTemplate
        personaLabel="SDR"
        headline="Daily shortlist → fast outreach"
        subhead="LeadIntel gives you a daily ranked list of accounts with “why now” context and a draft you can send."
        workflowSteps={[
          { title: 'Define ICP', detail: 'Set a tight ICP so fit is clear and repeatable.' },
          { title: 'Monitor accounts', detail: 'Add 10–25 target accounts and let signals come to you.' },
          { title: 'Send outreach', detail: 'Use the template draft and personalize the first 2 lines.' },
        ]}
        templates={[
          {
            title: 'Funding signal opener',
            tag: 'Email',
            body:
              'Subject: Quick congrats + one question\n\nCongrats on the funding — quick question: is the priority this quarter {{initiative}} or {{alt_initiative}}?\n\nIf {{initiative}} is on the roadmap, I can share a short checklist we use to prioritize accounts and reach out at the right time.\n\nWorth a quick 10 minutes?',
          },
          {
            title: 'Hiring spike opener',
            tag: 'LinkedIn',
            body:
              'Saw you’re hiring for {{role}} — is that tied to an initiative like {{initiative}}?\n\nIf yes, happy to share a short checklist to reduce friction during the build phase.',
          },
          {
            title: 'Product launch timing',
            tag: 'Email',
            body:
              'Subject: Quick question post‑launch\n\nCongrats on the launch.\n\nRight after GA, teams often hit a bottleneck in {{initiative}}. Is that on your radar this month?\n\nIf yes, I can share a short checklist to reduce friction in the first 30 days post‑launch.',
          },
        ]}
      />
    </MarketingPage>
  )
}

