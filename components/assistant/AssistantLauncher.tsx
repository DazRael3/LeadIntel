'use client'

import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

export function AssistantLauncher(props: { onOpen: () => void; label?: string; source: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
      onClick={() => {
        track('assistant_opened', { source: props.source })
        props.onOpen()
      }}
    >
      {props.label ?? 'Assistant'}
    </Button>
  )
}

