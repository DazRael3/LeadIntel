import type { ActionRecipeRow, ActionRecipeTrigger } from '@/lib/domain/action-recipes'
import type { AccountExplainability } from '@/lib/data/getAccountExplainability'
import { recipeMatchesAccount } from '@/lib/services/action-recipes'

export function evaluateAutomationRules(args: {
  trigger: ActionRecipeTrigger
  recipes: ActionRecipeRow[]
  explainability: AccountExplainability | null
}): ActionRecipeRow[] {
  const eligible = args.recipes.filter((r) => r.is_enabled && r.trigger_type === args.trigger)
  if (!args.explainability) return eligible
  return eligible.filter((r) => recipeMatchesAccount({ recipe: r, explainability: args.explainability as AccountExplainability }))
}

