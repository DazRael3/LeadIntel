'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type RecipeRow = { id: string; name: string; trigger_type: string; is_enabled: boolean }
type Envelope = { ok: true; data: { recipes: RecipeRow[] } } | { ok: false }

export function ActionRecipeSuggestions() {
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const enabledCount = recipes.filter((r) => r.is_enabled).length

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/workspace/recipes', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (cancelled) return
      if (!res.ok || !json || json.ok !== true) return
      setRecipes(json.data.recipes ?? [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Recipe suggestions</CardTitle>
          <Badge variant="outline">{enabledCount} enabled</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="text-xs text-muted-foreground">
          Recipes help standardize when handoffs are prepared and queued. They do not auto-send emails or create CRM records unless you deliver via a destination.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => (window.location.href = '/settings/integrations')}>
            Manage recipes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

