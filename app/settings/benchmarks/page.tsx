import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
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

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'benchmarks' })
  if (!gate.ok) return <TeamUpgradeGate />

  return <BenchmarksSettingsClient />
}

