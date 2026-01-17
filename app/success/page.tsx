'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PlanProvider, usePlan } from '@/components/PlanProvider'

function SuccessContent() {
  const router = useRouter()
  const { plan, isPro, refresh: refreshPlan, loading: planLoading } = usePlan()
  const [activating, setActivating] = useState(true)
  const [redirecting, setRedirecting] = useState(false)

  // Poll for Pro status after checkout
  useEffect(() => {
    let attempts = 0
    const maxAttempts = 10
    const pollInterval = 1000 // 1 second

    const checkProStatus = async () => {
      await refreshPlan()
      attempts++

      if (isPro) {
        setActivating(false)
        // Wait 2 seconds to show success, then redirect
        setTimeout(() => {
          setRedirecting(true)
          router.push('/dashboard')
        }, 2000)
      } else if (attempts >= maxAttempts) {
        // After 10 seconds, redirect anyway (webhook may be delayed)
        setActivating(false)
        setTimeout(() => {
          setRedirecting(true)
          router.push('/dashboard')
        }, 2000)
      } else {
        // Continue polling
        setTimeout(checkProStatus, pollInterval)
      }
    }

    // Start polling immediately
    checkProStatus()
  }, [isPro, refreshPlan, router])

  // Fallback: redirect after 15 seconds regardless
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!redirecting) {
        setRedirecting(true)
        router.push('/dashboard')
      }
    }, 15000)

    return () => clearTimeout(timer)
  }, [router, redirecting])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-green-500/20 bg-card/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-green-500/20 border border-green-500/30 w-fit">
            {activating ? (
              <Loader2 className="h-8 w-8 text-green-400 animate-spin" />
            ) : (
              <CheckCircle className="h-8 w-8 text-green-400" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {activating ? 'Activating Pro...' : 'Subscription Started'}
          </CardTitle>
          <CardDescription>
            {activating 
              ? 'Confirming your Pro subscription...'
              : 'Welcome to Pro! Your subscription is now active.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activating ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Please wait while we activate your Pro features...
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Verifying subscription status</span>
              </div>
            </div>
          ) : (
            <>
              <p className="text-center text-sm text-muted-foreground">
                You now have access to all Pro features, including unlimited AI-generated leads,
                personalized pitches, and enterprise intelligence.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setRedirecting(true)
                    router.push('/dashboard')
                  }}
                  className="flex-1 bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30"
                >
                  Go to Dashboard
                </Button>
              </div>
              {redirecting && (
                <p className="text-xs text-center text-muted-foreground">
                  Redirecting to dashboard...
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <PlanProvider initialPlan="free">
      <SuccessContent />
    </PlanProvider>
  )
}
