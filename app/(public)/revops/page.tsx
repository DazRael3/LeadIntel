import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PersonaTemplate } from '@/components/marketing/PersonaTemplate'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'For RevOps | LeadIntel',
  description: 'A consistent outbound system: signals, scoring, templates, and measurable workflows.',
  alternates: { canonical: 'https://raelinfo.com/revops' },
  openGraph: {
    title: 'For RevOps | LeadIntel',
    description: 'A consistent outbound system: signals, scoring, templates, and measurable workflows.',
    url: 'https://raelinfo.com/revops',
  },
}

export default function RevOpsPage() {
  return (
    <MarketingPage title="For RevOps" subtitle="Make outbound consistent: inputs, prioritization, templates, and reporting.">
      <PageViewTrack event="persona_view" props={{ persona: 'revops' }} />
      <PersonaTemplate
        personaLabel="RevOps"
        headline="Standardize daily outbound execution"
        subhead="Use signals and deterministic scoring to drive a repeatable daily workflow across reps."
        workflowSteps={[
          { title: 'Define ICP', detail: 'Standardize ICP inputs so scoring is comparable across reps/segments.' },
          { title: 'Watchlists', detail: 'Ensure each rep has 10–25 strong accounts to maintain signal density.' },
          { title: 'Templates', detail: 'Deploy consistent templates so you can measure reply/meeting rates.' },
        ]}
        templates={[
          {
            title: 'Ops-friendly check-in',
            tag: 'Email',
            body:
              'Subject: Quick question on your current priorities\n\nWe’re seeing signals that {{company}} is in a build phase (hiring/launch/partnership).\n\nIs the priority this month {{initiative}} (process) or {{alt_initiative}} (tooling)? If yes, I can share a short checklist we use to reduce friction and standardize outreach timing.\n\nWorth a quick 10 minutes?',
          },
          {
            title: 'Pilot CTA',
            tag: 'Email',
            body:
              'Subject: Small pilot idea\n\nIf you want to test a signal-driven outbound workflow, we can run a small pilot:\n- define ICP\n- add 10–25 accounts\n- compare outcomes vs. baseline\n\nOpen to a quick call to scope it?',
          },
          {
            title: 'Template governance',
            tag: 'LinkedIn',
            body:
              'If you’re standardizing outbound templates, happy to share a simple framework for message governance (when to use which template + what to measure).',
          },
        ]}
      />
    </MarketingPage>
  )
}

