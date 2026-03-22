'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import type { AssistantAnswer, AssistantScopeType, AssistantSuggestedAction } from '@/lib/assistant/types'
import { track } from '@/lib/analytics'
import { useToast } from '@/components/ui/use-toast'

type PromptEnvelope =
  | { ok: true; data: { scope: AssistantScopeType; prompts: Array<{ label: string; prompt: string }> } }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

type ChatEnvelope =
  | { ok: true; data: { threadId: string; answer: AssistantAnswer } }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

type ActionEnvelope =
  | { ok: true; data: { kind: string; preview?: unknown; result?: unknown; requiresConfirmation?: boolean } }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

type Msg = { id: string; role: 'user' | 'assistant'; content: string; answer?: AssistantAnswer }

export function AssistantPanel(props: {
  open: boolean
  onClose: () => void
  scope: { type: AssistantScopeType; id: string | null }
  title: string
}) {
  const { toast } = useToast()
  const [threadId, setThreadId] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<Array<{ label: string; prompt: string }>>([])
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [sending, setSending] = useState(false)
  const [locked, setLocked] = useState<{ code: string; message: string } | null>(null)
  const [actionPreview, setActionPreview] = useState<{ action: AssistantSuggestedAction; preview: unknown } | null>(null)
  const [actionConfirming, setActionConfirming] = useState(false)

  const scopeKey = useMemo(() => `${props.scope.type}:${props.scope.id ?? 'none'}`, [props.scope.id, props.scope.type])

  const lockFromError = useCallback((err: { code: string; message: string } | null | undefined) => {
    if (!err) return
    const code = err.code
    const message =
      code === 'ASSISTANT_PLAN_REQUIRED'
        ? 'Upgrade required to use the Assistant in workspace scope.'
        : code === 'ASSISTANT_WORKSPACE_REQUIRED'
          ? 'Workspace setup required to use the Assistant.'
          : code === 'ASSISTANT_INSUFFICIENT_PERMISSIONS'
            ? 'Insufficient permissions for this workspace.'
            : code === 'ASSISTANT_DISABLED'
              ? err.message
              : code === 'UNAUTHORIZED'
                ? 'Please sign in again to use the Assistant.'
                : err.message || 'Assistant unavailable.'
    setLocked({ code, message })
  }, [])

  const loadPrompts = useCallback(async () => {
    try {
      if (locked) return
      const res = await fetch(`/api/assistant/suggested-prompts?scope=${encodeURIComponent(props.scope.type)}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as PromptEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        if (json && 'error' in json) lockFromError(json.error)
        return
      }
      setPrompts(json.data.prompts ?? [])
    } catch {
      // ignore
    }
  }, [lockFromError, locked, props.scope.type])

  useEffect(() => {
    if (!props.open) return
    setMessages([])
    setInput('')
    setThreadId(null)
    setActionPreview(null)
    setLocked(null)
    void loadPrompts()
  }, [props.open, scopeKey, loadPrompts])

  const send = useCallback(
    async (prompt?: string) => {
      if (locked) return
      const msg = (prompt ?? input).trim()
      if (!msg) return
      setSending(true)
      try {
        const id = `u_${Date.now()}`
        setMessages((m) => [...m, { id, role: 'user', content: msg }])
        setInput('')
        track('assistant_prompt_submitted', { scope: props.scope.type })
        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ threadId, scope: props.scope, message: msg }),
        })
        const json = (await res.json().catch(() => null)) as ChatEnvelope | null
        if (!res.ok || !json || json.ok !== true) {
          if (json && 'error' in json) lockFromError(json.error)
          toast({ variant: 'destructive', title: 'Assistant unavailable', description: json && 'error' in json ? json.error.message : 'Please try again.' })
          return
        }
        setThreadId(json.data.threadId)
        setMessages((m) => [...m, { id: `a_${Date.now()}`, role: 'assistant', content: json.data.answer.answer, answer: json.data.answer }])
        track('assistant_answer_viewed', { scope: props.scope.type })
      } finally {
        setSending(false)
      }
    },
    [input, lockFromError, locked, props.scope, threadId, toast]
  )

  const previewAction = useCallback(
    async (action: AssistantSuggestedAction) => {
      if (action.kind === 'open_route') {
        window.location.href = action.href
        return
      }
      if (locked) return
      setActionPreview(null)
      const body =
        action.kind === 'prepare_crm_handoff'
          ? { kind: action.kind, accountId: action.accountId, window: action.window, confirm: false }
          : action.kind === 'prepare_sequencer_handoff'
            ? { kind: action.kind, accountId: action.accountId, window: action.window, confirm: false }
            : action.kind === 'add_to_queue'
              ? { kind: action.kind, accountId: action.accountId, reason: action.reason, confirm: false }
              : action.kind === 'request_template_approval'
                ? { kind: action.kind, templateId: action.templateId, note: action.note, confirm: false }
                : null
      if (!body) return
      const res = await fetch('/api/assistant/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const json = (await res.json().catch(() => null)) as ActionEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        if (json && 'error' in json) lockFromError(json.error)
        toast({ variant: 'destructive', title: 'Action unavailable', description: json && 'error' in json ? json.error.message : 'Please try again.' })
        return
      }
      setActionPreview({ action, preview: json.data.preview ?? null })
      track('assistant_action_suggested', { kind: action.kind })
    },
    [locked, lockFromError, toast]
  )

  const confirmAction = useCallback(async () => {
    if (!actionPreview) return
    setActionConfirming(true)
    try {
      const action = actionPreview.action
      const body =
        action.kind === 'prepare_crm_handoff'
          ? { kind: action.kind, accountId: action.accountId, window: action.window, confirm: true }
          : action.kind === 'prepare_sequencer_handoff'
            ? { kind: action.kind, accountId: action.accountId, window: action.window, confirm: true }
            : action.kind === 'add_to_queue'
              ? { kind: action.kind, accountId: action.accountId, reason: action.reason, confirm: true }
              : action.kind === 'request_template_approval'
                ? { kind: action.kind, templateId: action.templateId, note: action.note, confirm: true }
                : null
      if (!body) return
      const res = await fetch('/api/assistant/actions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const json = (await res.json().catch(() => null)) as ActionEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Action failed', description: json && 'error' in json ? json.error?.message : 'Please try again.' })
        return
      }
      toast({ variant: 'success', title: 'Done', description: 'Action completed.' })
      track('assistant_action_confirmed', { kind: action.kind })
      setActionPreview(null)
    } finally {
      setActionConfirming(false)
    }
  }, [actionPreview, toast])

  const panelContent = (
    <div className="space-y-3 text-sm text-muted-foreground">
      {locked ? (
        <div className="rounded border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
          <div className="font-semibold text-foreground">Assistant unavailable</div>
          <div className="mt-1">{locked.message}</div>
          {locked.code === 'ASSISTANT_PLAN_REQUIRED' ? (
            <div className="mt-2 text-muted-foreground">This surface requires a Team plan.</div>
          ) : null}
        </div>
      ) : null}
      {prompts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {prompts.slice(0, 6).map((p) => (
            <Button key={p.label} size="sm" variant="outline" className="h-8 text-xs" disabled={sending || Boolean(locked)} onClick={() => void send(p.prompt)}>
              {p.label}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        {messages.length === 0 ? (
          <div className="rounded border border-cyan-500/10 bg-card/30 p-3 text-xs text-muted-foreground">
            Ask a grounded question about this view. The assistant uses workspace-scoped product objects and won’t execute actions without confirmation.
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.role}</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">{m.content}</div>
            {m.answer?.suggestedActions && m.answer.suggestedActions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {m.answer.suggestedActions.slice(0, 4).map((a, idx) => (
                  <Button key={`${a.kind}:${idx}`} size="sm" variant="outline" className="h-8 text-xs" onClick={() => void previewAction(a)}>
                    {a.label}
                  </Button>
                ))}
              </div>
            ) : null}
            {m.answer?.limitationsNote ? <div className="mt-2 text-xs text-muted-foreground">Limitations: {m.answer.limitationsNote}</div> : null}
          </div>
        ))}
      </div>

      <div className="rounded border border-cyan-500/10 bg-card/30 p-3 space-y-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={locked ? 'Assistant is unavailable in this scope.' : 'Ask… (grounded to this scope)'}
          className="min-h-[70px]"
          disabled={sending || Boolean(locked)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={props.onClose} disabled={sending}>
            Close
          </Button>
          <Button className="neon-border hover:glow-effect" onClick={() => void send()} disabled={sending || Boolean(locked) || input.trim().length === 0}>
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>

      {actionPreview ? (
        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Action preview</div>
          <pre className="mt-2 max-h-[30vh] overflow-auto whitespace-pre-wrap text-xs text-foreground">{JSON.stringify(actionPreview.preview ?? {}, null, 2)}</pre>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActionPreview(null)} disabled={actionConfirming}>
              Cancel
            </Button>
            <Button className="neon-border hover:glow-effect" onClick={() => void confirmAction()} disabled={actionConfirming}>
              {actionConfirming ? 'Running…' : 'Confirm'}
            </Button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">This action will change workflow state. Confirmation is required.</div>
        </div>
      ) : null}
    </div>
  )

  const body = (
    <Card className="border-cyan-500/20 bg-background/95 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{props.title}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">scope {props.scope.type}</Badge>
              {props.scope.id ? <Badge variant="outline">{props.scope.id.slice(0, 8)}…</Badge> : null}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={props.onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">{panelContent}</CardContent>
    </Card>
  )

  if (!props.open) return null

  return (
    <>
      <div className="hidden md:block fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/50" onClick={props.onClose} />
        <div className="absolute right-0 top-0 h-full w-full max-w-xl p-4">{body}</div>
      </div>
      <div className="md:hidden">
        <MobileActionSheet open={props.open} title={props.title} onClose={props.onClose}>
          {panelContent}
        </MobileActionSheet>
      </div>
    </>
  )
}

