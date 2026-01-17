'use client'

import { Button } from '@/components/ui/button'

interface DebugInfo {
  [key: string]: unknown
  error?: string
  details?: string
}

interface DebugPanelProps {
  debugInfo: DebugInfo | null
  onClose: () => void
}

export function DebugPanel({ debugInfo, onClose }: DebugPanelProps) {
  if (!debugInfo) return null

  return (
    <div className="border-b border-yellow-500/20 bg-yellow-500/5 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs font-mono text-yellow-400 mb-1">Debug: /api/whoami</p>
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-6 text-xs"
          >
            ×
          </Button>
        </div>
      </div>
    </div>
  )
}
