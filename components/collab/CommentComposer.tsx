'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function CommentComposer(props: {
  placeholder?: string
  disabled?: boolean
  submitLabel?: string
  onSubmit: (body: string) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={props.placeholder ?? 'Add a comment…'}
        className="min-h-[84px] bg-background/40 border-cyan-500/10"
        disabled={props.disabled || saving}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          className="neon-border hover:glow-effect"
          disabled={props.disabled || saving || body.trim().length === 0}
          onClick={async () => {
            setSaving(true)
            try {
              await props.onSubmit(body.trim())
              setBody('')
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? 'Saving…' : props.submitLabel ?? 'Comment'}
        </Button>
      </div>
    </div>
  )
}

