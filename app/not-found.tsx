import Link from 'next/link'
import { TopNav } from '@/components/TopNav'
import { SiteFooter } from '@/components/SiteFooter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background terminal-grid">
      <TopNav />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Card className="border-cyan-500/20 bg-card/60 max-w-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl bloomberg-font neon-cyan">Page not found</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-4">
            <p>The page you’re looking for doesn’t exist or may have moved.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="neon-border hover:glow-effect">
                <Link href="/#try-sample">Try a sample digest</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">See pricing</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/support">Support</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </div>
  )
}

