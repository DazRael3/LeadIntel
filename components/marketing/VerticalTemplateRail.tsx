import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { VERTICAL_LIST } from '@/lib/verticals/registry'
import { getVerticalMessaging } from '@/lib/verticals/messaging'
import { getCuratedTemplatesForVertical, VERTICAL_TEMPLATE_CURATIONS } from '@/lib/verticals/templates'

function supportLabel(level: 'supported' | 'vertical_friendly' | 'not_yet_supported'): string {
  return level === 'supported' ? 'Supported' : level === 'vertical_friendly' ? 'Vertical-friendly' : 'Not yet supported'
}

export function VerticalTemplateRail() {
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">Best-fit template rails</CardTitle>
            <div className="text-sm text-muted-foreground">
              Curated by workflow and motion—templates stay intentionally neutral so you don’t over-claim.
            </div>
          </div>
          <Badge variant="outline">Verticalization (bounded)</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PageViewTrack event="vertical_template_rail_viewed" props={{ surface: 'templates' }} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {VERTICAL_LIST.map((v) => {
            const m = getVerticalMessaging(v.key)
            const curated = getCuratedTemplatesForVertical(v.key)
            const curMeta = VERTICAL_TEMPLATE_CURATIONS.find((c) => c.vertical === v.key)
            const show = curated.slice(0, 6)
            return (
              <div key={v.key} className="rounded border border-cyan-500/10 bg-background/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-foreground">{m.headline}</div>
                      <Badge variant="outline">{supportLabel(v.supportLevel)}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{m.subhead}</div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/use-cases">Use cases</Link>
                  </Button>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">{curMeta?.description ?? 'Recommended templates'}</div>

                {show.length === 0 ? (
                  <div className="mt-3 text-sm text-muted-foreground">No curated templates available for this fit.</div>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {show.map((t) => (
                      <Link
                        key={t.slug}
                        href={`/templates/${t.slug}`}
                        prefetch={false}
                        className="rounded border border-cyan-500/10 bg-background/60 px-3 py-2 hover:border-cyan-500/25 transition"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium text-foreground">{t.title}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[11px]">
                              {t.channel}
                            </Badge>
                            <Badge variant="outline" className="text-[11px]">
                              {t.trigger}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.notes}</div>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="mt-3 text-[11px] text-muted-foreground">{m.disclaimer}</div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

