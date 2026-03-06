import { getPriceIdsFromEnv, resolveCheckoutLineItems, type BillingCycle, type PaidPlanId } from '@/lib/billing/stripePriceMap'

export type EnvSubsystemKey = 'posthog' | 'resend' | 'stripe' | 'supabase_service_role' | 'cron_secrets' | 'openai'

export type EnvSubsystemReport = {
  key: EnvSubsystemKey
  label: string
  configured: boolean
  missingKeys: string[]
  impact: string
}

function hasEnv(name: string): boolean {
  const v = (process.env[name] ?? '').trim()
  return v.length > 0
}

function missing(...keys: string[]): string[] {
  return keys.filter((k) => !hasEnv(k))
}

function stripeMissingPriceKeys(): string[] {
  const out = new Set<string>()

  const plans: PaidPlanId[] = ['pro', 'closer_plus', 'team']
  const cycles: BillingCycle[] = ['monthly', 'annual']
  for (const planId of plans) {
    for (const cycle of cycles) {
      const res = resolveCheckoutLineItems(planId, cycle, 3)
      if (!res.ok) {
        for (const m of res.missing) out.add(m)
      }
    }
  }

  // If team base+seat is configured but single team price is not, the resolver is still ok.
  // This helper uses resolveCheckoutLineItems, so it's already aligned with checkout behavior.
  return Array.from(out)
}

export function runEnvDoctor(): { subsystems: EnvSubsystemReport[]; missingKeys: string[] } {
  const subsystems: EnvSubsystemReport[] = []

  // PostHog (server reads for kpi_monitor)
  const posthogMissing = missing('POSTHOG_PROJECT_ID', 'POSTHOG_PERSONAL_API_KEY')
  subsystems.push({
    key: 'posthog',
    label: 'PostHog (KPI monitor reads)',
    configured: posthogMissing.length === 0,
    missingKeys: posthogMissing,
    impact: posthogMissing.length === 0 ? 'kpi_monitor can run' : 'kpi_monitor will skip',
  })

  // Resend (lifecycle + digest + alerts)
  const resendMissing = missing('RESEND_API_KEY', 'RESEND_FROM_EMAIL')
  subsystems.push({
    key: 'resend',
    label: 'Resend (lifecycle + digests + alerts)',
    configured: resendMissing.length === 0,
    missingKeys: resendMissing,
    impact: resendMissing.length === 0 ? 'Email jobs can send' : 'Email jobs may skip sending (or degrade to dry-run behavior)',
  })

  // Stripe (checkout)
  const stripeCoreMissing = missing('STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  const stripePriceMissing = stripeMissingPriceKeys()
  const stripeMissing = Array.from(new Set([...stripeCoreMissing, ...stripePriceMissing]))
  const envPrices = getPriceIdsFromEnv()
  subsystems.push({
    key: 'stripe',
    label: 'Stripe (checkout + portal + webhooks)',
    configured: stripeMissing.length === 0,
    missingKeys: stripeMissing,
    impact:
      stripeMissing.length === 0
        ? 'Checkout and billing flows can run'
        : `Checkout may fail with CHECKOUT_NOT_CONFIGURED (configured prices: ${Object.entries(envPrices)
            .filter(([, v]) => Boolean(v))
            .map(([k]) => k)
            .join(', ') || 'none'})`,
  })

  // Supabase service role (jobs/admin ops/exports)
  const supabaseMissing = missing('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')
  subsystems.push({
    key: 'supabase_service_role',
    label: 'Supabase service role (jobs/admin ops/exports)',
    configured: supabaseMissing.length === 0,
    missingKeys: supabaseMissing,
    impact: supabaseMissing.length === 0 ? 'Automation persistence and admin ops can run' : 'Automation persistence and admin ops will be disabled',
  })

  // Cron secrets
  const cronMissing = missing('CRON_SECRET')
  const externalCronMissing = hasEnv('EXTERNAL_CRON_SECRET') ? [] : ['EXTERNAL_CRON_SECRET']
  const cronCombined = Array.from(new Set([...cronMissing, ...externalCronMissing]))
  subsystems.push({
    key: 'cron_secrets',
    label: 'Cron auth (external schedulers)',
    configured: cronCombined.length === 0,
    missingKeys: cronCombined,
    impact: cronCombined.length === 0 ? 'Cron endpoints can be called securely' : 'External cron calls may be blocked (or rely on a single secret)',
  })

  // OpenAI (pitch generation)
  const openaiMissing = missing('OPENAI_API_KEY')
  subsystems.push({
    key: 'openai',
    label: 'OpenAI (pitch generation)',
    configured: openaiMissing.length === 0,
    missingKeys: openaiMissing,
    impact: openaiMissing.length === 0 ? 'Pitch generation can run' : 'Pitch generation will fail or be disabled',
  })

  const missingKeys = subsystems.flatMap((s) => s.missingKeys)

  return { subsystems, missingKeys }
}

