import type { ReactNode } from 'react'
import { DashboardShell } from '@/app/dashboard/DashboardShell'
import { getMarketProviderLabelFromEnv } from '@/lib/market/providerLabel'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const providerLabel = getMarketProviderLabelFromEnv()
  const marketDataSourceLabel =
    process.env.NODE_ENV === 'production' ? providerLabel ?? null : providerLabel ?? 'Dev / Mock'

  return <DashboardShell marketDataSourceLabel={marketDataSourceLabel}>{children}</DashboardShell>
}
