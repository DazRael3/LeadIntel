'use client'

export function RecommendationLimitations(props: { note: string | null }) {
  if (!props.note) return null
  return (
    <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
      <span className="text-foreground font-medium">Limitations:</span> {props.note}
    </div>
  )
}

