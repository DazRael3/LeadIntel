'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'

export function CopyTextButton(props: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(props.text)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        } catch {
          // If clipboard permissions are blocked, the user can still select manually from the pre block.
        }
      }}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </>
      )}
    </Button>
  )
}

