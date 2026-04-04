import type { LifecycleEmailType } from '@/lib/email/lifecycle'

export type LifecycleSendField =
  | 'welcome_sent_at'
  | 'nudge_accounts_sent_at'
  | 'nudge_pitch_sent_at'
  | 'first_output_sent_at'
  | 'starter_near_limit_sent_at'
  | 'starter_exhausted_sent_at'
  | 'feedback_request_sent_at'
  | 'upgrade_confirm_sent_at'
  | 'value_recap_sent_at'
  | 'winback_sent_at'

export type LifecycleCadenceState = Partial<Record<LifecycleSendField, string | null>>

export function getLifecycleStopReason(args: {
  allowProductUpdates: boolean
  productTipsOptIn: boolean
  replySignalChecked: boolean
  hasRepliedLifecycleEmail: boolean
  hasBouncedEmail: boolean
  upgraded: boolean
  upgradeConfirmSentAt?: string | null
}):
  | 'global_unsubscribe'
  | 'opted_out'
  | 'reply_signal_unavailable'
  | 'replied'
  | 'bounced'
  | 'converted'
  | null {
  if (!args.allowProductUpdates) return 'global_unsubscribe'
  if (!args.productTipsOptIn) return 'opted_out'
  // Safety guard: if we cannot verify reply-stop signals, avoid sending more lifecycle emails.
  if (!args.replySignalChecked) return 'reply_signal_unavailable'
  if (args.hasRepliedLifecycleEmail) return 'replied'
  if (args.hasBouncedEmail) return 'bounced'
  if (args.upgraded && Boolean(args.upgradeConfirmSentAt)) return 'converted'
  return null
}

export function selectLifecycleStep(args: {
  state: LifecycleCadenceState
  hoursSinceSignup: number
  daysSinceSignup: number
  accountsCount: number
  pitchesCount: number
  activated: boolean
  upgraded: boolean
  premiumUsed: number
  premiumDays: number | null
  starterLimit: number
}): { type: LifecycleEmailType; field: LifecycleSendField } | null {
  const s = args.state

  if (!s.welcome_sent_at) return { type: 'welcome', field: 'welcome_sent_at' }

  // Conversion stop: only allow one upgrade confirmation as the final lifecycle step.
  if (args.upgraded) {
    if (!s.upgrade_confirm_sent_at) return { type: 'upgrade_confirmation', field: 'upgrade_confirm_sent_at' }
    return null
  }

  if (args.hoursSinceSignup >= 6 && args.accountsCount < 10 && !s.nudge_accounts_sent_at) {
    return { type: 'nudge_accounts', field: 'nudge_accounts_sent_at' }
  }
  if (args.hoursSinceSignup >= 24 && args.pitchesCount < 1 && args.premiumUsed === 0 && !s.nudge_pitch_sent_at) {
    return { type: 'nudge_pitch', field: 'nudge_pitch_sent_at' }
  }

  if (args.premiumUsed >= args.starterLimit && !s.starter_exhausted_sent_at) {
    return { type: 'starter_exhausted', field: 'starter_exhausted_sent_at' }
  }
  if (args.premiumUsed === args.starterLimit - 1 && !s.starter_near_limit_sent_at) {
    return { type: 'starter_near_limit', field: 'starter_near_limit_sent_at' }
  }

  if (args.premiumUsed >= 1 && args.premiumDays !== null && args.premiumDays <= 7 && !s.first_output_sent_at) {
    return { type: 'first_output', field: 'first_output_sent_at' }
  }
  if (args.daysSinceSignup >= 3 && args.activated && !s.value_recap_sent_at) {
    return { type: 'value_recap', field: 'value_recap_sent_at' }
  }
  if (args.daysSinceSignup >= 7 && !args.activated && !s.winback_sent_at) {
    return { type: 'winback', field: 'winback_sent_at' }
  }

  if (args.premiumUsed >= 1 && args.premiumDays !== null && args.premiumDays >= 2 && !s.feedback_request_sent_at) {
    return { type: 'feedback_request', field: 'feedback_request_sent_at' }
  }

  return null
}
