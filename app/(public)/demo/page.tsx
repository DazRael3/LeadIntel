import type { Metadata } from 'next'
import { DemoClient } from './DemoClient'

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
  return <DemoClient />
}
