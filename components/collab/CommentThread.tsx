'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Comment, CommentThread as Thread } from '@/lib/domain/comments'
import { CommentComposer } from '@/components/collab/CommentComposer'

function fmt(ts: string): string {
  const d = new Date(ts)
  if (!Number.isFinite(d.getTime())) return ts
  return d.toLocaleString()
}

export function CommentThread(props: {
  thread: Thread
  comments: Comment[]
  onReply: (threadId: string, body: string) => Promise<void>
  onToggleResolved: (threadId: string, resolved: boolean) => Promise<void>
}) {
  const [replying, setReplying] = useState(false)

  const statusBadge = useMemo(() => {
    if (props.thread.status === 'resolved') return <Badge variant="outline">Resolved</Badge>
    return <Badge variant="outline">Open</Badge>
  }, [props.thread.status])

  return (
    <Card className="border-cyan-500/10 bg-background/30">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">{props.thread.thread_type.replaceAll('_', ' ')}</CardTitle>
          <div className="flex items-center gap-2">
            {statusBadge}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => props.onToggleResolved(props.thread.id, props.thread.status !== 'resolved')}
            >
              {props.thread.status === 'resolved' ? 'Reopen' : 'Resolve'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReplying((v) => !v)}>
              Reply
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="space-y-2">
          {props.comments.map((c) => (
            <div key={c.id} className="rounded border border-cyan-500/10 bg-background/40 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>by {c.author_user_id.slice(0, 8)}</span>
                <span title={c.created_at}>{fmt(c.created_at)}</span>
              </div>
              <div className="mt-1 text-sm text-foreground whitespace-pre-wrap">{c.body_text}</div>
            </div>
          ))}
        </div>

        {replying ? (
          <CommentComposer
            placeholder="Reply…"
            submitLabel="Reply"
            onSubmit={async (body) => {
              await props.onReply(props.thread.id, body)
              setReplying(false)
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

