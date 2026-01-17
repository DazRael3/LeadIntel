'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function CancelPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-yellow-500/20 bg-card/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-yellow-500/20 border border-yellow-500/30 w-fit">
            <XCircle className="h-8 w-8 text-yellow-400" />
          </div>
          <CardTitle className="text-2xl">Checkout Canceled</CardTitle>
          <CardDescription>
            Your subscription was not completed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            No charges were made. You can try again anytime or continue using the free plan.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/pricing')}
              className="flex-1"
            >
              Back to Pricing
            </Button>
            <Button
              onClick={() => router.push('/dashboard')}
              className="flex-1 bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
