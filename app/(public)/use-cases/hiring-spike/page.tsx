import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'
import { getUseCasePlaybook } from '@/lib/use-cases/playbooks'

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
  const playbook = getUseCasePlaybook('hiring-spike')
  return (
    <MarketingPage title={playbook.title} subtitle={playbook.subtitle}>
      <PageViewTrack event="use_case_view" props={{ useCase: 'hiring_spike' }} />
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
