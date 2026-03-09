import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { BenchmarksSettingsClient } from './benchmarks-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Benchmarks Settings | LeadIntel',
  description: 'Govern privacy-safe benchmarking and comparative insights for your workspace.',
}

export default async function BenchmarksSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/settings/benchmarks')

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok) return <TeamUpgradeGate />

  return <BenchmarksSettingsClient />
}

