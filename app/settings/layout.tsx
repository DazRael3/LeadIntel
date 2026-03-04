import type { ReactNode } from 'react'
import { DashboardShell } from '@/app/dashboard/DashboardShell'
import { getMarketProviderLabelFromEnv } from '@/lib/market/providerLabel'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const providerLabel = getMarketProviderLabelFromEnv()
  const marketDataSourceLabel = process.env.NODE_ENV === 'production' ? null : providerLabel ?? 'Dev / Mock'
  return <DashboardShell marketDataSourceLabel={marketDataSourceLabel}>{children}</DashboardShell>
}

