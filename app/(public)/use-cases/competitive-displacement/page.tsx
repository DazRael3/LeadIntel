import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'
import { getUseCasePlaybook } from '@/lib/use-cases/playbooks'

export const metadata: Metadata = {
  title: 'Competitive displacement playbook | LeadIntel',
  description: 'Use battlecard-style angles when an account is evaluating alternatives.',
  openGraph: {
    title: 'Competitive displacement playbook | LeadIntel',
    description: 'Use battlecard-style angles when an account is evaluating alternatives.',
    url: 'https://dazrael.com/use-cases/competitive-displacement',
    images: [
      {
        url: '/api/og?title=Competitive%20displacement&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function CompetitiveDisplacementUseCasePage() {
  const playbook = getUseCasePlaybook('competitive-displacement')
  return (
    <MarketingPage title={playbook.title} subtitle={playbook.subtitle}>
      <PageViewTrack event="use_case_view" props={{ useCase: 'competitive_displacement' }} />
      <PlaybookTemplate
        title={playbook.title}
        subtitle={playbook.subtitle}
        promise={playbook.promise}
        whenWorksBest={playbook.whenWorksBest}
        timingSignals={playbook.timingSignals}
        angles={playbook.angles}
        sequencePack={playbook.sequencePack}
        objections={playbook.objections}
        personalizationExamples={playbook.personalizationExamples}
        related={playbook.related}
      />
    </MarketingPage>
  )
}
