'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LEARNING_MODULES, LEARNING_PATHS } from '@/lib/enablement/paths'
import type { LearningModuleId, LearningPathId } from '@/lib/enablement/types'
import Link from 'next/link'
import { track } from '@/lib/analytics'

function storageKey(pathId: LearningPathId): string {
  return `li_learning_progress:${pathId}`
}

function loadProgress(pathId: LearningPathId): Set<LearningModuleId> {
  if (typeof window === 'undefined') return new Set()
  const raw = window.localStorage.getItem(storageKey(pathId))
  if (!raw) return new Set()
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is LearningModuleId => typeof x === 'string') as LearningModuleId[])
  } catch {
    return new Set()
  }
}

function saveProgress(pathId: LearningPathId, completed: Set<LearningModuleId>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(pathId), JSON.stringify(Array.from(completed)))
}

export function LearnClient() {
  const [activePath, setActivePath] = useState<LearningPathId>('rep_basics')
  const [completed, setCompleted] = useState<Set<LearningModuleId>>(new Set())

  useEffect(() => {
    setCompleted(loadProgress(activePath))
    track('learning_path_viewed', { pathId: activePath })
  }, [activePath])

  const path = useMemo(() => LEARNING_PATHS.find((p) => p.id === activePath) ?? LEARNING_PATHS[0], [activePath])
  const modules = useMemo(() => path.modules.map((id) => LEARNING_MODULES[id]), [path.modules])

  function toggle(id: LearningModuleId) {
    const next = new Set(completed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCompleted(next)
    saveProgress(activePath, next)
    track('learning_module_completed', { pathId: activePath, moduleId: id, completed: next.has(id) })
  }

  const doneCount = modules.filter((m) => completed.has(m.id)).length

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="learn-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Learn</h1>
            <p className="mt-1 text-sm text-muted-foreground">Guided learning foundations. This is not a certification.</p>
          </div>
          <Badge variant="outline">
            {doneCount}/{modules.length} completed (this device)
          </Badge>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Learning paths</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {LEARNING_PATHS.map((p) => (
              <Button key={p.id} size="sm" variant={p.id === activePath ? 'default' : 'outline'} onClick={() => setActivePath(p.id)}>
                {p.title}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{path.title}</CardTitle>
              <Badge variant="outline">{path.id}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="text-sm text-foreground">{path.description}</div>
            <div className="text-xs text-muted-foreground">{path.disclaimer}</div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {modules.map((m) => {
            const isDone = completed.has(m.id)
            return (
              <Card key={m.id} className="border-cyan-500/20 bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{m.minutes}m</Badge>
                      <Badge variant="outline">{isDone ? 'done' : 'not done'}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div>{m.description}</div>
                  <div className="text-xs text-muted-foreground">{m.evidenceNote}</div>
                  <div className="flex flex-wrap gap-2">
                    {m.surfaceLinks.map((l) => (
                      <Link key={l.href} href={l.href} className="text-xs underline text-cyan-300">
                        {l.label}
                      </Link>
                    ))}
                  </div>
                  <Button size="sm" variant={isDone ? 'outline' : 'default'} onClick={() => toggle(m.id)}>
                    {isDone ? 'Mark not done' : 'Mark done'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

