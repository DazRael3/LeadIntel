import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'
import { getUseCasePlaybook } from '@/lib/use-cases/playbooks'

export const metadata: Metadata = {
  title: 'Funding outreach playbook | LeadIntel',
  description: 'Turn fresh funding signals into timely outreach with a clear “why now” angle.',
  openGraph: {
    title: 'Funding outreach playbook | LeadIntel',
    description: 'Turn fresh funding signals into timely outreach with a clear “why now” angle.',
    url: 'https://dazrael.com/use-cases/funding-outreach',
    images: [
      {
        url: '/api/og?title=Funding%20outreach&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function FundingOutreachUseCasePage() {
  const playbook = getUseCasePlaybook('funding-outreach')
  return (
    <MarketingPage title={playbook.title} subtitle={playbook.subtitle}>
      <PageViewTrack event="use_case_viewed" props={{ useCase: 'funding_outreach' }} />
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
