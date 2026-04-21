import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PersonaTemplate } from '@/components/marketing/PersonaTemplate'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'For founders | LeadIntel',
  description: 'Founder-led outbound with daily signals, prioritization, and consistent templates.',
  alternates: { canonical: 'https://raelinfo.com/founder' },
  openGraph: {
    title: 'For founders | LeadIntel',
    description: 'Founder-led outbound with daily signals, prioritization, and consistent templates.',
    url: 'https://raelinfo.com/founder',
  },
}

export default function FounderPage() {
  return (
    <MarketingPage title="For founders" subtitle="Founder-led outbound that’s consistent, focused, and signal-driven.">
      <PageViewTrack event="persona_view" props={{ persona: 'founder' }} />
      <PersonaTemplate
        personaLabel="Founder"
        headline="Less research. More conversations."
        subhead="Get a small daily list of accounts with reasons to reach out—then use a simple template you can personalize fast."
        workflowSteps={[
          { title: 'Pick a wedge', detail: 'Define a tight ICP and a clear problem you solve.' },
          { title: 'Add targets', detail: 'Add 10–25 accounts you want to win this quarter.' },
          { title: 'Send daily', detail: 'Use the draft outreach and personalize the first 1–2 lines.' },
        ]}
        templates={[
          {
            title: 'Funding signal',
            tag: 'Email',
            body:
              'Subject: Quick congrats + one question\n\nCongrats on the funding — quick question: is the priority this quarter {{initiative}}?\n\nIf yes, I can share a short idea we’ve used to help similar teams move faster.\n\nWorth a quick 10 minutes?',
          },
          {
            title: 'Hiring spike',
            tag: 'LinkedIn',
            body:
              'Saw you’re hiring for {{role}} — is that tied to an initiative like {{initiative}}?\n\nIf yes, happy to share a short checklist to remove friction during the build phase.',
          },
          {
            title: 'Launch timing',
            tag: 'Email',
            body:
              'Subject: Quick question post‑launch\n\nCongrats on the launch.\n\nRight after GA, teams often hit friction in {{initiative}}. Is that on your radar this month?\n\nIf yes, I can share a short checklist to reduce friction in the first 30 days post‑launch.',
          },
        ]}
      />
    </MarketingPage>
  )
}

