export type ActionRecipeTrigger =
  | 'manual_action'
  | 'brief_saved'
  | 'report_generated'
  | 'tracked_account_added'
  | 'account_score_threshold'
  | 'momentum_state'
  | 'first_party_intent_state'

export type ActionRecipeAction =
  | 'prepare_crm_handoff'
  | 'prepare_sequencer_handoff'
  | 'deliver_webhook_payload'
  | 'create_export_job'
  | 'require_manual_review'
  | 'save_queue_item'

export type ActionRecipeConditions =
  | {
      type: 'none'
    }
  | {
      type: 'account_score_threshold'
      minScore: number
    }
  | {
      type: 'momentum_state'
      state: 'rising' | 'steady' | 'cooling'
    }
  | {
      type: 'first_party_intent_state'
      state: 'active' | 'inactive'
    }
  | {
      type: 'data_quality'
      quality: 'limited' | 'usable' | 'strong'
    }

export type ActionRecipeRow = {
  id: string
  workspace_id: string
  name: string
  trigger_type: ActionRecipeTrigger
  conditions: ActionRecipeConditions
  action_type: ActionRecipeAction
  destination_type: 'webhook' | 'export' | null
  destination_id: string | null
  is_enabled: boolean
  created_by: string
  created_at: string
  updated_at: string
}

