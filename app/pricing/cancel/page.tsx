'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { XCircle, ArrowLeft } from 'lucide-react'

export default function PricingCancelPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background terminal-grid flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-yellow-500/30 bg-card/80">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-yellow-500/20 border border-yellow-500/30">
              <XCircle className="h-12 w-12 text-yellow-400" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Checkout Canceled</h1>
            <p className="text-muted-foreground">
              Your checkout was canceled. No charges were made.
            </p>
            <p className="text-sm text-muted-foreground">
              You can return to pricing anytime to upgrade to Pro.
            </p>
          </div>

          <div className="flex gap-3 justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => router.push('/pricing')}
              className="neon-border"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pricing
            </Button>
            <Button
              onClick={() => router.push('/dashboard')}
              className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
