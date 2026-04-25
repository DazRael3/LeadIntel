import type { Metadata } from 'next'
import { DemoClient } from './DemoClient'

export const metadata: Metadata = {
  title: 'Lead generation demo | LeadIntel',
  description: 'Run a demo lead search, preview partial results, then unlock full workflow.',
  alternates: { canonical: 'https://raelinfo.com/demo' },
  openGraph: {
    title: 'Lead generation demo | LeadIntel',
    description: 'Run a demo lead search, preview partial results, then unlock full workflow.',
    url: 'https://raelinfo.com/demo',
  },
}

export default function DemoPage() {
  return <DemoClient />
}
