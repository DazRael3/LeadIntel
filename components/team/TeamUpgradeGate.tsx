import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function TeamUpgradeGate() {
  return (
    <div className="min-h-screen bg-background terminal-grid">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Unlock Team features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Shared templates, governance, and admin visibility across reps.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="neon-border hover:glow-effect">
                <Link href="/pricing?target=team">Upgrade to Team</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

