import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PersonaTemplate } from '@/components/marketing/PersonaTemplate'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'For agencies | LeadIntel',
  description: 'Run repeatable outbound plays across client accounts using daily signals and templates.',
  openGraph: {
    title: 'For agencies | LeadIntel',
    description: 'Run repeatable outbound plays across client accounts using daily signals and templates.',
    url: 'https://dazrael.com/agency',
  },
}

export default function AgencyPage() {
  return (
    <MarketingPage title="For agencies" subtitle="Repeatable signal-driven outreach across clients, without redoing research.">
      <PageViewTrack event="persona_view" props={{ persona: 'agency' }} />
      <PersonaTemplate
        personaLabel="Agency"
        headline="Standardize playbooks across accounts"
        subhead="Use the same daily workflow for each client: shortlist → why now → template draft."
        workflowSteps={[
          { title: 'Per-client ICP', detail: 'Define an ICP for each client so scoring stays consistent.' },
          { title: 'Account lists', detail: 'Build watchlists of target accounts per client.' },
          { title: 'Templates', detail: 'Use copy/paste templates to keep output consistent and measurable.' },
        ]}
        templates={[
          {
            title: 'Partnership announcement',
            tag: 'Email',
            body:
              'Subject: Quick question on the rollout\n\nSaw the partnership announcement — congrats.\n\nAre you already thinking through the rollout handoff between teams? If helpful, I can share a short checklist to prevent common rollout friction.\n\nWorth a quick 10 minutes?',
          },
          {
            title: 'Expansion signal',
            tag: 'Email',
            body:
              'Subject: Quick scaling checklist\n\nExpansion often exposes friction in [handoffs/reporting/enablement].\n\nIs that on your radar right now? If yes, I can share a short checklist to spot the bottleneck and prioritize fixes.\n\nWorth a quick 10 minutes?',
          },
          {
            title: 'Competitive displacement',
            tag: 'LinkedIn',
            body:
              'If you’re evaluating alternatives to [VENDOR], I can share a 1‑page decision checklist (requirements, rollout risk, maintenance).\n\nWant it?',
          },
        ]}
      />
    </MarketingPage>
  )
}

