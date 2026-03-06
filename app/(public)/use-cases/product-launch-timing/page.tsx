import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'
import { getUseCasePlaybook } from '@/lib/use-cases/playbooks'

export const metadata: Metadata = {
  title: 'Product launch timing playbook | LeadIntel',
  description: 'Use launch signals to time outreach around high-change periods.',
  openGraph: {
    title: 'Product launch timing playbook | LeadIntel',
    description: 'Use launch signals to time outreach around high-change periods.',
    url: 'https://dazrael.com/use-cases/product-launch-timing',
    images: [
      {
        url: '/api/og?title=Product%20launch%20timing&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function ProductLaunchTimingUseCasePage() {
  const playbook = getUseCasePlaybook('product-launch-timing')
  return (
    <MarketingPage title={playbook.title} subtitle={playbook.subtitle}>
      <PageViewTrack event="use_case_view" props={{ useCase: 'product_launch_timing' }} />
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
