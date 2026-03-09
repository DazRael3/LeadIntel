import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LearnClient } from './learn-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Learn | LeadIntel',
  description: 'Guided learning paths (foundations).',
}

export default async function LearnPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/learn')
  return <LearnClient />
}

