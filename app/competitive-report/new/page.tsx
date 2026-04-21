import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TopNav } from '@/components/TopNav'
import { createClient } from '@/lib/supabase/server'
import { CompetitiveReportNewClient } from './ui/CompetitiveReportNewClient'

export const metadata: Metadata = {
  title: 'Competitive Report Redirect | LeadIntel',
  description: 'Legacy route redirecting to the competitive reports hub.',
  alternates: { canonical: 'https://raelinfo.com/competitive-report' },
  robots: { index: false, follow: true },
}

export const dynamic = 'force-dynamic'

export default async function CompetitiveReportNewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?mode=signin&redirect=/competitive-report')
  }

  // Backward compatibility: `/competitive-report/new` is deprecated.
  // The single landing page is `/competitive-report` (hub), which can auto-generate.
  redirect('/competitive-report')
}

