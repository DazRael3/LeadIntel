import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { PlaybookTemplate } from '@/components/marketing/PlaybookTemplate'
import { getUseCasePlaybook } from '@/lib/use-cases/playbooks'

export const metadata: Metadata = {
  title: 'Partnership announcement playbook | LeadIntel',
  description: 'Use partnership announcements as a precise wedge for timely outbound.',
  alternates: { canonical: 'https://raelinfo.com/use-cases/partnership-announcement' },
  openGraph: {
    title: 'Partnership announcement playbook | LeadIntel',
    description: 'Use partnership announcements as a precise wedge for timely outbound.',
    url: 'https://raelinfo.com/use-cases/partnership-announcement',
    images: [
      {
        url: '/api/og?title=Partnership%20announcements&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function PartnershipAnnouncementUseCasePage() {
  const playbook = getUseCasePlaybook('partnership-announcement')
  return (
    <MarketingPage title={playbook.title} subtitle={playbook.subtitle}>
      <PageViewTrack event="use_case_viewed" props={{ useCase: 'partnership_announcement' }} />
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
