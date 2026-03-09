import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { ActionRecipeConditions, ActionRecipeAction, ActionRecipeTrigger } from '@/lib/domain/action-recipes'

type Draft = {
  name: string
  trigger_type: ActionRecipeTrigger
  action_type: ActionRecipeAction
  conditions: ActionRecipeConditions
}

export function RecipeBuilder(props: {
  disabled?: boolean
  onCreate: (draft: Draft) => Promise<void>
}) {
  const [name, setName] = useState('Prepare CRM handoff on brief save')
  const [trigger, setTrigger] = useState<ActionRecipeTrigger>('brief_saved')
  const [action, setAction] = useState<ActionRecipeAction>('prepare_crm_handoff')
  const [minScore, setMinScore] = useState('70')
  const [saving, setSaving] = useState(false)

  const conditions: ActionRecipeConditions = useMemo(() => {
    if (trigger === 'account_score_threshold') {
      const n = Number(minScore)
      return { type: 'account_score_threshold', minScore: Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 70 }
    }
    return { type: 'none' }
  }, [trigger, minScore])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Create recipe</CardTitle>
          <Badge variant="outline">Compact</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name" />
          <select
            className="h-10 rounded-md border border-cyan-500/10 bg-background/40 px-3 text-sm text-foreground"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as ActionRecipeTrigger)}
          >
            <option value="manual_action">Manual</option>
            <option value="brief_saved">Brief saved</option>
            <option value="report_generated">Report generated</option>
            <option value="tracked_account_added">Tracked account added</option>
            <option value="account_score_threshold">Score threshold</option>
          </select>
          <select
            className="h-10 rounded-md border border-cyan-500/10 bg-background/40 px-3 text-sm text-foreground"
            value={action}
            onChange={(e) => setAction(e.target.value as ActionRecipeAction)}
          >
            <option value="prepare_crm_handoff">Prepare CRM handoff</option>
            <option value="prepare_sequencer_handoff">Prepare Sequencer handoff</option>
            <option value="require_manual_review">Require manual review</option>
            <option value="save_queue_item">Save queue item</option>
          </select>
          {trigger === 'account_score_threshold' ? (
            <Input value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="Min score (0-100)" />
          ) : (
            <div className="h-10 rounded-md border border-cyan-500/10 bg-background/30 px-3 text-xs flex items-center">
              No condition
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            className="neon-border hover:glow-effect"
            disabled={props.disabled || saving || name.trim().length === 0}
            onClick={async () => {
              setSaving(true)
              try {
                await props.onCreate({ name: name.trim(), trigger_type: trigger, action_type: action, conditions })
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Saving…' : 'Create recipe'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

