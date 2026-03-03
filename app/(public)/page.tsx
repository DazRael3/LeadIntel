import { redirect } from 'next/navigation'
import LandingClient from '../LandingClient'
import { createClient } from '@/lib/supabase/server'
import { JsonLd } from '@/components/seo/JsonLd'

export default async function Page() {
  try {
    const supabase = createClient()
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
      description: 'Daily “why now” signals, deterministic scoring, and outreach templates for outbound teams.',
    },
  ]

  return (
    <>
      <JsonLd data={jsonLd} />
      <LandingClient />
    </>
  )
}
