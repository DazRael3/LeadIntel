import Link from 'next/link'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LEAD_GENERATION_PAGES } from '@/lib/seo/lead-generation-pages'

export default function AiLeadGenerationIndexPage() {
  return (
    <MarketingPage
      title="AI lead generation by niche"
      subtitle="Pick your niche to see an ICP-specific lead generation workflow and launch a demo."
    >
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Available niche pages</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {LEAD_GENERATION_PAGES.map((entry) => (
              <Link
                key={entry.slug}
                href={`/ai-lead-generation/${entry.slug}`}
                className="rounded border border-cyan-500/20 bg-background/50 p-3 hover:border-cyan-400/40 hover:text-foreground"
              >
                AI lead generation for {entry.nicheLabel}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </MarketingPage>
  )
}
