'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type FeedbackKind =
  | 'useful'
  | 'not_useful'
  | 'wrong_persona'
  | 'wrong_timing'
  | 'wrong_angle'
  | 'good_opener'
  | 'weak_opener'
  | 'manual_override'

export function RecommendationFeedbackBar(props: {
  accountId: string
  recommendationType: string
  recommendationVersion: string
}) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState<FeedbackKind | null>(null)

  async function submit(kind: FeedbackKind) {
    setSubmitting(kind)
    try {
      track('recommendation_feedback_submitted', { kind, accountId: props.accountId, recommendationType: props.recommendationType })
      const res = await fetch('/api/recommendations/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targetType: 'account',
          targetId: props.accountId,
          recommendationType: props.recommendationType,
          recommendationVersion: props.recommendationVersion,
          kind,
        }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        toast({ variant: 'destructive', title: 'Feedback failed', description: json?.error?.message ?? 'Please try again.' })
        return
      }
      toast({ title: 'Thanks.', description: 'Feedback saved.' })
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={!!submitting} onClick={() => void submit('useful')}>
        Useful
      </Button>
      <Button size="sm" variant="outline" disabled={!!submitting} onClick={() => void submit('not_useful')}>
        Not useful
      </Button>
      <Button size="sm" variant="outline" disabled={!!submitting} onClick={() => void submit('wrong_timing')}>
        Wrong timing
      </Button>
      <Button size="sm" variant="outline" disabled={!!submitting} onClick={() => void submit('wrong_persona')}>
        Wrong persona
      </Button>
      <Button size="sm" variant="outline" disabled={!!submitting} onClick={() => void submit('wrong_angle')}>
        Wrong angle
      </Button>
    </div>
  )
}

