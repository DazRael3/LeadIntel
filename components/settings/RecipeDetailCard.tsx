import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function RecipeDetailCard() {
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">How recipes work</CardTitle>
          <Badge variant="outline">Guided</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div className="text-xs text-muted-foreground">
          Recipes create queue items when a trigger happens (brief saved, report generated, manual). They help teams standardize handoffs without pretending LeadIntel is a full automation platform.
        </div>
        <div className="text-xs text-muted-foreground">
          Deliveries only happen when a rep explicitly delivers via a configured destination.
        </div>
      </CardContent>
    </Card>
  )
}

