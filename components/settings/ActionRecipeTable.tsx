import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ActionRecipeRow } from '@/lib/domain/action-recipes'

function labelTrigger(t: ActionRecipeRow['trigger_type']): string {
  if (t === 'manual_action') return 'Manual'
  if (t === 'brief_saved') return 'Brief saved'
  if (t === 'report_generated') return 'Report generated'
  if (t === 'tracked_account_added') return 'Tracked account added'
  if (t === 'account_score_threshold') return 'Score threshold'
  if (t === 'momentum_state') return 'Momentum state'
  if (t === 'first_party_intent_state') return 'First-party intent'
  return t
}

function labelAction(a: ActionRecipeRow['action_type']): string {
  if (a === 'prepare_crm_handoff') return 'Prepare CRM handoff'
  if (a === 'prepare_sequencer_handoff') return 'Prepare Sequencer handoff'
  if (a === 'deliver_webhook_payload') return 'Deliver webhook payload'
  if (a === 'create_export_job') return 'Create export job'
  if (a === 'require_manual_review') return 'Require manual review'
  return 'Save queue item'
}

function condSummary(c: ActionRecipeRow['conditions']): string {
  if (c.type === 'none') return '—'
  if (c.type === 'account_score_threshold') return `Score ≥ ${c.minScore}`
  if (c.type === 'momentum_state') return `Momentum: ${c.state}`
  if (c.type === 'first_party_intent_state') return `Intent: ${c.state}`
  if (c.type === 'data_quality') return `Data quality: ${c.quality}`
  return '—'
}

export function ActionRecipeTable(props: {
  role: 'owner' | 'admin' | 'member'
  recipes: ActionRecipeRow[]
  onToggleEnabled: (recipeId: string, next: boolean) => void
  disabled?: boolean
}) {
  const isAdmin = props.role === 'owner' || props.role === 'admin'
  const rows = useMemo(() => props.recipes.slice(0, 50), [props.recipes])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Action recipes</CardTitle>
          <Badge variant="outline">Guided</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="text-xs text-muted-foreground">
          Recipes create queue items when matching triggers occur. This is guided workflow orchestration—not autonomous sending.
        </div>

        {rows.length === 0 ? (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
            No recipes yet. Create one to standardize handoff workflows across the team.
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-cyan-500/10">
            <table className="w-full text-xs">
              <thead className="bg-background/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Trigger</th>
                  <th className="px-3 py-2 text-left">Condition</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-cyan-500/10">
                    <td className="px-3 py-2 text-foreground">{r.name}</td>
                    <td className="px-3 py-2">{labelTrigger(r.trigger_type)}</td>
                    <td className="px-3 py-2">{condSummary(r.conditions)}</td>
                    <td className="px-3 py-2">{labelAction(r.action_type)}</td>
                    <td className="px-3 py-2">
                      {isAdmin ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={props.disabled}
                          onClick={() => props.onToggleEnabled(r.id, !r.is_enabled)}
                        >
                          {r.is_enabled ? 'On' : 'Off'}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">{r.is_enabled ? 'On' : 'Off'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

