'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { ThreadSummary } from '@/components/collab/ThreadSummary'
import { CommentComposer } from '@/components/collab/CommentComposer'
import { CommentThread } from '@/components/collab/CommentThread'
import type { Comment, CommentThread as Thread, CommentTargetType, CommentThreadType } from '@/lib/domain/comments'

type Envelope =
  | { ok: true; data: { threads: Thread[]; commentsByThread: Record<string, Comment[]> } }
  | { ok: false; error?: { message?: string } }

export function CommentThreadPanel(props: { targetType: CommentTargetType; targetId: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [threads, setThreads] = useState<Thread[]>([])
  const [commentsByThread, setCommentsByThread] = useState<Record<string, Comment[]>>({})
  const [creatingType, setCreatingType] = useState<CommentThreadType>('general')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ target_type: props.targetType, target_id: props.targetId })
      const res = await fetch(`/api/workspace/comments?${qs.toString()}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        setThreads([])
        setCommentsByThread({})
        return
      }
      setThreads(json.data.threads ?? [])
      setCommentsByThread(json.data.commentsByThread ?? {})
    } catch {
      setThreads([])
      setCommentsByThread({})
    } finally {
      setLoading(false)
    }
  }, [props.targetId, props.targetType])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    let open = 0
    let resolved = 0
    for (const t of threads) {
      if (t.status === 'resolved') resolved++
      else open++
    }
    return { open, resolved }
  }, [threads])

  async function createNew(body: string) {
    const res = await fetch('/api/workspace/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: props.targetType, target_id: props.targetId, thread_type: creatingType, body }),
    })
    if (!res.ok) {
      toast({ variant: 'destructive', title: 'Comment failed', description: 'Please try again.' })
      return
    }
    toast({ variant: 'success', title: 'Posted' })
    await load()
  }

  async function replyTo(threadId: string, body: string) {
    const res = await fetch('/api/workspace/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_id: threadId, body }),
    })
    if (!res.ok) {
      toast({ variant: 'destructive', title: 'Reply failed', description: 'Please try again.' })
      return
    }
    await load()
  }

  async function toggleResolved(threadId: string, nextResolved: boolean) {
    const res = await fetch('/api/workspace/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_id: threadId, resolved: nextResolved }),
    })
    if (!res.ok) {
      toast({ variant: 'destructive', title: 'Update failed', description: 'Please try again.' })
      return
    }
    await load()
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Comments</CardTitle>
          <ThreadSummary openCount={counts.open} resolvedCount={counts.resolved} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-muted-foreground">New thread type</div>
          <select
            className="h-9 rounded-md border border-cyan-500/10 bg-background/40 px-2 text-sm text-foreground"
            value={creatingType}
            onChange={(e) => {
              const v = e.target.value
              if (
                v === 'general' ||
                v === 'review_feedback' ||
                v === 'changes_requested' ||
                v === 'manager_note' ||
                v === 'handoff_note'
              )
                setCreatingType(v)
            }}
          >
            <option value="general">General</option>
            <option value="review_feedback">Review feedback</option>
            <option value="changes_requested">Changes requested</option>
            <option value="manager_note">Manager note</option>
            <option value="handoff_note">Handoff note</option>
          </select>
        </div>

        <CommentComposer onSubmit={createNew} submitLabel="Start thread" />

        {loading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : threads.length === 0 ? (
          <div className="text-xs text-muted-foreground">No threads yet.</div>
        ) : (
          <div className="space-y-3">
            {threads.map((t) => (
              <CommentThread
                key={t.id}
                thread={t}
                comments={commentsByThread[t.id] ?? []}
                onReply={replyTo}
                onToggleResolved={toggleResolved}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

