import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PersonaTemplate } from '@/components/marketing/PersonaTemplate'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'For AEs | LeadIntel',
  description: 'Prioritize the right accounts with a reasons-based score and battlecard-style outreach.',
  alternates: { canonical: 'https://raelinfo.com/ae' },
  openGraph: {
    title: 'For AEs | LeadIntel',
    description: 'Prioritize the right accounts with a reasons-based score and battlecard-style outreach.',
    url: 'https://raelinfo.com/ae',
  },
}

export default function AePage() {
  return (
    <MarketingPage title="For AEs" subtitle="Tighter prioritization and sharper POV for late-stage outbound and expansion.">
      <PageViewTrack event="persona_view" props={{ persona: 'ae' }} />
      <PersonaTemplate
        personaLabel="AE"
        headline="Score + reasons → cleaner POV"
        subhead="Use the 0–100 score to focus on accounts with fresh signals, then lead with a crisp point of view."
        workflowSteps={[
          { title: 'Tight ICP', detail: 'Define ICP so fit is obvious and repeatable across territory.' },
          { title: 'Daily shortlist', detail: 'Work the highest-signal accounts first (fresh triggers + strong fit).' },
          { title: 'POV outreach', detail: 'Send a battlecard-style message with one next step.' },
        ]}
        templates={[
          {
            title: 'Competitive displacement',
            tag: 'Email',
            body:
              'Subject: Quick evaluation checklist\n\nIf you’re evaluating alternatives to {{vendor}}, here’s a quick checklist:\n1) Must-have requirements\n2) Rollout + adoption risk\n3) Reporting + long-term maintenance\n\nIf useful, I can share a 1‑page comparison checklist for teams in your space.\n\nWorth a quick 10 minutes?',
          },
          {
            title: 'Expansion signal',
            tag: 'Email',
            body:
              'Subject: Quick scaling question\n\nWhen teams expand, the first pain often shows up in {{pain}} (handoffs/reporting/enablement).\n\nIs that on your radar right now? If yes, I can share a short checklist to spot the bottleneck and prioritize fixes.\n\nWorth a quick 10 minutes?',
          },
          {
            title: 'Partnership rollout',
            tag: 'LinkedIn',
            body:
              'Congrats on the partnership announcement — are you already thinking through the rollout handoff between teams?\n\nIf yes, I can share a short checklist to prevent common rollout friction.',
          },
        ]}
      />
    </MarketingPage>
  )
}

