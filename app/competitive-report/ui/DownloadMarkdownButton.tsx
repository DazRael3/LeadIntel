'use client'

import { Button } from '@/components/ui/button'

export function DownloadMarkdownButton(props: { filename: string; markdown: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        const blob = new Blob([props.markdown], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = props.filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }}
    >
      Download
    </Button>
  )
}

