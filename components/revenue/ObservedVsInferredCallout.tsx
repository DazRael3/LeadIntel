'use client'

export function ObservedVsInferredCallout() {
  return (
    <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
      <div className="text-foreground font-medium">Observed vs inferred</div>
      <div className="mt-1">
        Planning guidance uses a mix of <span className="text-foreground font-medium">observed</span> signals (events, intent, workflow actions) and{' '}
        <span className="text-foreground font-medium">inferred</span> suggestions (persona path). Influence labels are not revenue attribution.
      </div>
    </div>
  )
}

