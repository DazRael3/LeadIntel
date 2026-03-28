import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TopNav } from '@/components/TopNav'
import { createClient } from '@/lib/supabase/server'
import { CompetitiveReportNewClient } from './ui/CompetitiveReportNewClient'

export const metadata: Metadata = {
  title: 'New Competitive Report | LeadIntel',
  description: 'Generate a structured competitive intelligence report and save it to your Reports hub.',
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

