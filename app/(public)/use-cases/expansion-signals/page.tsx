import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'
import { getUseCasePlaybook } from '@/lib/use-cases/playbooks'

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
  const playbook = getUseCasePlaybook('expansion-signals')
  return (
    <MarketingPage title={playbook.title} subtitle={playbook.subtitle}>
      <PageViewTrack event="use_case_view" props={{ useCase: 'expansion_signals' }} />
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
