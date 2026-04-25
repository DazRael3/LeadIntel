'use client'

import { Component, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketTickerBar } from '@/components/MarketTickerBar'
import { useMarketWatchlist } from '@/app/hooks/useMarketWatchlist'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: ReactNode
}

class DashboardErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Dashboard Error Boundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-red-400" />
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
                variant="outline"
              >
                Reload Page
              </Button>
              <Button
                onClick={() => {
                  window.location.href = '/'
                }}
                variant="default"
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function DashboardShell({
  children,
  marketDataSourceLabel,
  activePathnamePrefix,
}: {
  children: ReactNode
  marketDataSourceLabel?: string | null
  activePathnamePrefix?: string
}) {
  const { defaultTicker, yourWatchlist } = useMarketWatchlist()

  return (
    <DashboardErrorBoundary>
      <MarketTickerBar
        instruments={defaultTicker}
        starredInstruments={yourWatchlist}
        dataSourceLabel={marketDataSourceLabel ?? null}
      />
      {activePathnamePrefix === '/settings' ? (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <a
              href="/settings/notifications"
              className="rounded border border-cyan-500/20 bg-card/40 px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              Preferences
            </a>
            <a
              href="/settings/billing"
              className="rounded border border-cyan-500/20 bg-card/40 px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              Billing
            </a>
            <a
              href="/settings/exports"
              className="rounded border border-cyan-500/20 bg-card/40 px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              Exports
            </a>
            <a
              href="/settings/team"
              className="rounded border border-cyan-500/20 bg-card/40 px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              Team
            </a>
          </div>
        </div>
      ) : null}
      {children}
    </DashboardErrorBoundary>
  )
}

