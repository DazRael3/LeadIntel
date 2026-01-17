'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, TrendingUp, Users, Building2, Rocket, Handshake } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { TriggerEvent } from "@/lib/supabaseClient"

interface TriggerEventCardProps {
  event: TriggerEvent
  onGeneratePitch?: (companyUrl: string, companyName: string) => void
}

const eventIcons = {
  funding: TrendingUp,
  new_hires: Users,
  expansion: Building2,
  product_launch: Rocket,
  partnership: Handshake,
}

const eventColors = {
  funding: "bg-green-500/20 text-green-400 border-green-500/50",
  new_hires: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  expansion: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  product_launch: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  partnership: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
}

export function TriggerEventCard({ event, onGeneratePitch }: TriggerEventCardProps) {
  const Icon = eventIcons[event.event_type] || TrendingUp
  const colorClass = eventColors[event.event_type] || eventColors.funding

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colorClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{event.company_name}</CardTitle>
              <CardDescription className="mt-1">
                {formatDate(event.detected_at)}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className={colorClass}>
            {event.event_type.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {event.event_description}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(event.source_url, '_blank')}
            className="flex-1 whitespace-nowrap min-w-0"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Source
          </Button>
          {onGeneratePitch && event.company_url && (
            <Button
              size="sm"
              onClick={() => onGeneratePitch(event.company_url!, event.company_name)}
              className="flex-1 whitespace-nowrap min-w-0"
            >
              Generate Pitch
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
