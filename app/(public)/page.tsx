import { redirect } from 'next/navigation'
import LandingClient from '../LandingClient'
import { createClient } from '@/lib/supabase/server'
import { JsonLd } from '@/components/seo/JsonLd'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LeadIntel | Why-now signals and send-ready drafts',
  description:
    'Signal-based outbound platform: why-now intelligence, daily shortlist, explainable scoring, and send-ready drafts.',
  alternates: { canonical: 'https://dazrael.com' },
  openGraph: {
    title: 'LeadIntel | Why-now signals and send-ready drafts',
    description:
      'Why-now intelligence, daily shortlist, explainable scoring, and send-ready drafts in minutes.',
    url: 'https://dazrael.com',
    images: [
      {
        url: '/api/og?title=LeadIntel&subtitle=Why-now%20signals%20%E2%86%92%20send-ready%20drafts',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default async function Page() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      redirect('/dashboard')
    }
  } catch {
    // If Supabase env vars are missing/malformed, fall back to anonymous landing.
  }

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'LeadIntel',
      url: 'https://dazrael.com',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'LeadIntel',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: 'https://dazrael.com',
      description: 'Why-now signals for outbound teams with an explainable score and send-ready drafts.',
    },
  ]

  return (
    <>
      <JsonLd data={jsonLd} />
      <LandingClient />
    </>
  )
}
