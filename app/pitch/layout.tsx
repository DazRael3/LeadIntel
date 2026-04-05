import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pitch Draft Generator | LeadIntel',
  description: 'Generate review-first outreach drafts using account context and why-now signals.',
  alternates: { canonical: 'https://dazrael.com/pitch' },
}

export default function PitchLayout({ children }: { children: React.ReactNode }) {
  return children
}
