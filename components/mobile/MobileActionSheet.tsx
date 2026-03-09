'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function MobileActionSheet(props: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  if (!props.open) return null
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={props.onClose} />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <Card className="border-cyan-500/20 bg-background/95 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{props.title}</CardTitle>
              <Button size="sm" variant="outline" onClick={props.onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>{props.children}</CardContent>
        </Card>
      </div>
    </div>
  )
}

