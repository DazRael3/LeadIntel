'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatErrorMessage } from '@/lib/utils/format-error'

type PollStatus = 'pending' | 'pro' | 'timeout' | 'error'

function PricingSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [status, setStatus] = useState<PollStatus>('pending')
  const [error, setError] = useState<string | null>(null)

  const sessionLabel = useMemo(() => {
    if (!sessionId) return null
    return `${sessionId.substring(0, 20)}...`
  }, [sessionId])

  useEffect(() => {
    let attempts = 0
    let cancelled = false

    const poll = async () => {
      try {
        const resp = await fetch('/api/plan', { method: 'GET', cache: 'no-store' })
        if (!resp.ok) throw new Error(`Status ${resp.status}`)
        const text = await resp.text()
        if (!text || text.trim().length === 0) {
          throw new Error('Empty response from /api/plan')
        }
        let data
        try {
          data = JSON.parse(text)
        } catch (parseError: unknown) {
          const msg = parseError instanceof Error ? parseError.message : 'Unknown parse error'
          throw new Error(`Invalid JSON: ${msg}`)
        }
        if (data?.plan === 'pro') {
          if (!cancelled) {
            setStatus('pro')
            setError(null)
            setTimeout(() => router.push('/dashboard'), 800)
          }
          return
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(formatErrorMessage(err))
          setStatus('error')
        }
      }

      attempts += 1
      if (attempts >= 15) {
        if (!cancelled) setStatus('timeout')
        return
      }
      setTimeout(poll, 2000)
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [router])

  const heading =
    status === 'pro'
      ? 'You are Pro!'
      : status === 'timeout'
        ? 'Still processing...'
        : status === 'error'
          ? 'Verification issue'
          : 'Payment Successful!'

  const description =
    status === 'pro'
      ? 'Your subscription is active. Redirecting to your dashboard.'
      : status === 'timeout'
        ? 'We are still waiting for Stripe to confirm your subscription. This can take a few seconds.'
        : status === 'error'
          ? 'We could not confirm your subscription yet. Please refresh or try again.'
          : 'Your subscription is being activated. This may take a few seconds.'

  const showSpinner = status === 'pending'
  const showRetry = status === 'timeout' || status === 'error'

  return (
    <div className="min-h-screen bg-background terminal-grid flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-green-500/30 bg-card/80">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-green-500/20 border border-green-500/30">
              {status === 'timeout' || status === 'error' ? (
                <AlertTriangle className="h-12 w-12 text-amber-400" />
              ) : (
                <CheckCircle className="h-12 w-12 text-green-400" />
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{heading}</h1>
            <p className="text-muted-foreground">
              {description}
            </p>
            {sessionLabel && (
              <p className="text-xs text-muted-foreground font-mono mt-2">
                Session: {sessionLabel}
              </p>
            )}
          </div>

          {showSpinner && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Waiting for confirmation...</span>
            </div>
          )}

          {error && (
            <p className="text-xs text-amber-300/80">{error}</p>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => router.push('/dashboard')}
              className="text-sm"
            >
              Go to Dashboard
            </Button>
            {showRetry && (
              <Button
                variant="outline"
                onClick={() => {
                  setStatus('pending')
                  setError(null)
                  router.refresh()
                }}
                className="text-sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh status
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PricingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background terminal-grid flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-green-500/30 bg-card/80">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-green-400 animate-spin" />
          </CardContent>
        </Card>
      </div>
    }>
      <PricingSuccessContent />
    </Suspense>
  )
}
