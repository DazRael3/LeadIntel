'use client'

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { track } from '@/lib/analytics'

type FeedbackSentiment = 'up' | 'down' | 'note'
type DeviceClass = 'mobile' | 'desktop' | 'unknown'

function getDeviceClass(): DeviceClass {
  if (typeof window === 'undefined') return 'unknown'
  const w = window.innerWidth
  if (!Number.isFinite(w)) return 'unknown'
  return w < 768 ? 'mobile' : 'desktop'
}

function getViewport(): { w?: number; h?: number } {
  if (typeof window === 'undefined') return {}
  const w = Math.max(0, Math.floor(window.innerWidth || 0))
  const h = Math.max(0, Math.floor(window.innerHeight || 0))
  return { w, h }
}

export function FeedbackCard(props: {
  surface: string
  title?: string
  prompt?: string
  className?: string
}) {
  const pathname = usePathname()
  const route = useMemo(() => (typeof pathname === 'string' && pathname.trim() ? pathname : '/'), [pathname])

  const [expanded, setExpanded] = useState(false)
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null)
  const [message, setMessage] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title = props.title ?? 'Feedback'
  const prompt = props.prompt ?? 'Was this helpful?'

  const submit = async (s: FeedbackSentiment) => {
    setError(null)
    setSaved(false)
    setSentiment(s)
    setExpanded(true)
    track('feedback_opened', { surface: props.surface, route, sentiment: s, deviceClass: getDeviceClass() })
  }

  const send = async () => {
    if (!sentiment) return
    setSaving(true)
    setError(null)
    try {
      const viewport = getViewport()
      const deviceClass = getDeviceClass()
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route,
          surface: props.surface,
          sentiment,
          message,
          deviceClass,
          viewport,
        }),
        keepalive: true,
      })
      if (!res.ok) {
        setError('Could not send feedback. Please try again.')
        return
      }
      setSaved(true)
      setMessage('')
      track('feedback_submitted', { surface: props.surface, route, sentiment, deviceClass })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={props.className ?? 'border-cyan-500/20 bg-card/60'}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">{prompt}</div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sentiment === 'up' ? 'default' : 'outline'}
              size="sm"
              className="min-h-10 px-4"
              onClick={() => void submit('up')}
              aria-pressed={sentiment === 'up'}
            >
              Yes
            </Button>
            <Button
              type="button"
              variant={sentiment === 'down' ? 'default' : 'outline'}
              size="sm"
              className="min-h-10 px-4"
              onClick={() => void submit('down')}
              aria-pressed={sentiment === 'down'}
            >
              Not yet
            </Button>
          </div>
        </div>

        {expanded ? (
          <div className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional: what should we improve? (No passwords or API keys)"
              className="min-h-[96px]"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                Keep it short and privacy-safe. We only store what you submit.
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10 px-4"
                  onClick={() => {
                    setExpanded(false)
                    setSentiment(null)
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-10 px-4 neon-border hover:glow-effect"
                  disabled={saving}
                  onClick={() => void send()}
                >
                  {saving ? 'Sending…' : 'Send feedback'}
                </Button>
              </div>
            </div>
            {saved ? <div className="text-xs text-cyan-300">Thanks — feedback received.</div> : null}
            {error ? <div className="text-xs text-red-300">{error}</div> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

