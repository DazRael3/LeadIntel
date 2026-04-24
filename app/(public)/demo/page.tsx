import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { TrySampleDigest } from '@/components/landing/TrySampleDigest'

export const metadata: Metadata = {
  title: 'Lead generation demo | LeadIntel',
  description: 'Run a demo lead search, preview partial results, then unlock full workflow.',
  alternates: { canonical: 'https://dazrael.com/demo' },
  openGraph: {
    title: 'Lead generation demo | LeadIntel',
    description: 'Run a demo lead search, preview partial results, then unlock full workflow.',
    url: 'https://dazrael.com/demo',
  },
}

export default function DemoPage() {
  return (
    <MarketingPage
      title="Generate your first leads"
      subtitle="Search one account, review partial results, then unlock full workflow in dashboard."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <TrySampleDigest />
      </div>
    </MarketingPage>
  )
}
