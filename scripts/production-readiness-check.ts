import fs from 'node:fs'
import path from 'node:path'

type CheckStatus = 'pass' | 'fail' | 'warn'

type CheckResult = {
  name: string
  status: CheckStatus
  details: string
}

const ROOT = process.cwd()

const CRITICAL_FILES = [
  'app/(public)/page.tsx',
  'app/(public)/demo/page.tsx',
  'app/(public)/pricing/page.tsx',
  'app/(public)/signup/page.tsx',
  'app/(public)/login/page.tsx',
  'app/lead-results/page.tsx',
  'app/dashboard/page.tsx',
  'app/dashboard/actions/page.tsx',
  'app/campaign/page.tsx',
  'app/settings/billing/page.tsx',
  'app/api/checkout/route.ts',
  'app/api/stripe/webhook/route.ts',
  'app/api/billing/verify-checkout-session/route.ts',
  'app/api/plan/route.ts',
] as const

const REQUIRED_MIGRATIONS = [
  '0038_exports.sql',
  '0066_expand_users_subscription_tier.sql',
  '0085_stripe_webhook_idempotency_required.sql',
  '0087_demo_sessions_and_campaigns.sql',
  '0089_demo_sessions_explicit_rls_policy.sql',
] as const

const REQUIRED_SCRIPTS = ['typecheck', 'lint', 'test:unit', 'build', 'test:e2e', 'check:production'] as const

const REQUIRED_ENV = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'OPENAI_API_KEY',
] as const

const SECRET_VALUE_PATTERNS = [
  /^sk_(live|test)_/i,
  /^whsec_/i,
  /^rk_(live|test)_/i,
  /^re_/i,
  /^xox[baprs]-/i,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/i,
  /service_role/i,
]

const NEXT_PUBLIC_VALUE_ALLOWLIST = new Set<string>([
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_META_PIXEL_ID',
  'NEXT_PUBLIC_TIKTOK_PIXEL_ID',
])

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath))
}

function readUtf8(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8')
}

function getEnv(name: string): string {
  return (process.env[name] ?? '').trim()
}

function parseHostname(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return null
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  try {
    const json = Buffer.from(base64, 'base64').toString('utf8')
    const parsed = JSON.parse(json) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function hasSecretLikePattern(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))
}

function push(results: CheckResult[], name: string, status: CheckStatus, details: string): void {
  results.push({ name, status, details })
}

function runChecks(): CheckResult[] {
  const results: CheckResult[] = []

  const missingEnv = REQUIRED_ENV.filter((name) => getEnv(name).length === 0)
  if (missingEnv.length === 0) {
    push(results, 'required-env', 'pass', 'Core production env vars are present.')
  } else {
    push(results, 'required-env', 'fail', `Missing: ${missingEnv.join(', ')}`)
  }

  const stripeProMonthly = getEnv('STRIPE_PRICE_ID_PRO') || getEnv('STRIPE_PRICE_ID')
  const stripeProAnnual = getEnv('STRIPE_PRICE_ID_CLOSER_ANNUAL')
  const stripePlusMonthly = getEnv('STRIPE_PRICE_ID_CLOSER_PLUS')
  const stripePlusAnnual = getEnv('STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL')
  const stripeTeamMonthly = getEnv('STRIPE_PRICE_ID_TEAM') || (getEnv('STRIPE_PRICE_ID_TEAM_BASE') && getEnv('STRIPE_PRICE_ID_TEAM_SEAT'))
  const stripeTeamAnnual =
    getEnv('STRIPE_PRICE_ID_TEAM_ANNUAL') ||
    (getEnv('STRIPE_PRICE_ID_TEAM_BASE_ANNUAL') && getEnv('STRIPE_PRICE_ID_TEAM_SEAT_ANNUAL'))

  const missingPriceFamilies: string[] = []
  if (!stripeProMonthly) missingPriceFamilies.push('STRIPE_PRICE_ID_PRO (or STRIPE_PRICE_ID)')
  if (!stripeProAnnual) missingPriceFamilies.push('STRIPE_PRICE_ID_CLOSER_ANNUAL')
  if (!stripePlusMonthly) missingPriceFamilies.push('STRIPE_PRICE_ID_CLOSER_PLUS')
  if (!stripePlusAnnual) missingPriceFamilies.push('STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL')
  if (!stripeTeamMonthly) missingPriceFamilies.push('STRIPE_PRICE_ID_TEAM (or TEAM_BASE + TEAM_SEAT)')
  if (!stripeTeamAnnual) missingPriceFamilies.push('STRIPE_PRICE_ID_TEAM_ANNUAL (or TEAM_BASE_ANNUAL + TEAM_SEAT_ANNUAL)')

  if (missingPriceFamilies.length > 0) {
    push(results, 'stripe-price-presence', 'fail', `Missing price configuration: ${missingPriceFamilies.join(', ')}`)
  } else {
    push(results, 'stripe-price-presence', 'pass', 'All Stripe plan families are configured.')
  }

  const stripePriceEntries = Object.entries(process.env).flatMap(([name, value]) => {
    if (!name.startsWith('STRIPE_PRICE_ID')) return []
    if (typeof value !== 'string') return []
    const trimmed = value.trim()
    if (trimmed.length === 0) return []
    return [[name, trimmed] as const]
  })
  const invalidStripePriceEntries = stripePriceEntries.filter(([, value]) => !/^price_[A-Za-z0-9_]+$/.test(value))
  if (invalidStripePriceEntries.length > 0) {
    push(
      results,
      'stripe-price-format',
      'fail',
      `Invalid price id format: ${invalidStripePriceEntries.map(([name]) => name).join(', ')}`
    )
  } else {
    push(results, 'stripe-price-format', 'pass', 'Stripe price IDs use expected price_* format.')
  }

  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseHost = parseHostname(supabaseUrl)
  if (!supabaseHost) {
    push(results, 'supabase-url-format', 'fail', 'NEXT_PUBLIC_SUPABASE_URL is missing or invalid.')
  } else {
    push(results, 'supabase-url-format', 'pass', `Supabase URL parses correctly (${supabaseHost}).`)
  }

  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const anonPayload = decodeJwtPayload(anonKey)
  const anonRole = typeof anonPayload?.role === 'string' ? anonPayload.role : null
  if (!anonKey) {
    push(results, 'supabase-anon-key', 'fail', 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.')
  } else if (anonRole === 'service_role') {
    push(results, 'supabase-anon-key', 'fail', 'NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be a service_role key.')
  } else {
    push(results, 'supabase-anon-key', 'pass', anonRole ? `Supabase anon key role is ${anonRole}.` : 'Supabase anon key is set.')
  }

  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  const servicePayload = decodeJwtPayload(serviceRoleKey)
  const serviceRole = typeof servicePayload?.role === 'string' ? servicePayload.role : null
  if (!serviceRoleKey) {
    push(results, 'supabase-service-role-key', 'fail', 'SUPABASE_SERVICE_ROLE_KEY is missing.')
  } else if (serviceRoleKey === anonKey) {
    push(results, 'supabase-service-role-key', 'fail', 'Service role key matches anon key.')
  } else {
    const detail = serviceRole ? `Service role key decodes with role=${serviceRole}.` : 'Service role key is configured.'
    push(results, 'supabase-service-role-key', 'pass', detail)
  }

  const nextPublicEntries = Object.entries(process.env).flatMap(([name, value]) => {
    if (!name.startsWith('NEXT_PUBLIC_')) return []
    if (typeof value !== 'string') return []
    const trimmed = value.trim()
    if (trimmed.length === 0) return []
    return [[name, trimmed] as const]
  })
  const leakedPublicKeys: string[] = []
  for (const [name, value] of nextPublicEntries) {
    if (name === 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' && !/^pk_(live|test)_/i.test(value)) {
      leakedPublicKeys.push(`${name} (must start with pk_)`)
      continue
    }
    if (NEXT_PUBLIC_VALUE_ALLOWLIST.has(name)) continue
    if (hasSecretLikePattern(value)) leakedPublicKeys.push(name)
  }

  if (leakedPublicKeys.length > 0) {
    push(results, 'next-public-secret-scan', 'fail', `Potential secret values in NEXT_PUBLIC vars: ${leakedPublicKeys.join(', ')}`)
  } else {
    push(results, 'next-public-secret-scan', 'pass', 'No secret-looking values found in NEXT_PUBLIC_* env vars.')
  }

  const canonicalSiteUrl = getEnv('NEXT_PUBLIC_SITE_URL')
  const appUrl = getEnv('APP_URL')
  const canonicalHosts = [canonicalSiteUrl, appUrl].filter((value) => value.length > 0).map((value) => parseHostname(value))
  const invalidCanonicalHosts = canonicalHosts.filter((host): host is string => host !== null && host !== 'raelinfo.com')
  if (!canonicalSiteUrl) {
    push(results, 'canonical-domain-env', 'fail', 'NEXT_PUBLIC_SITE_URL must be set to https://raelinfo.com')
  } else if (canonicalSiteUrl !== 'https://raelinfo.com') {
    push(results, 'canonical-domain-env', 'fail', 'NEXT_PUBLIC_SITE_URL must be exactly https://raelinfo.com in production checks.')
  } else if (invalidCanonicalHosts.length > 0) {
    push(results, 'canonical-domain-env', 'fail', `Canonical env host mismatch: ${invalidCanonicalHosts.join(', ')}`)
  } else {
    push(results, 'canonical-domain-env', 'pass', 'Canonical env domain is raelinfo.com.')
  }

  const canonicalFiles = ['app/layout.tsx', 'lib/app-url.ts', 'middleware.ts', 'app/robots.ts', 'app/sitemap.ts'] as const
  const canonicalFileIssues: string[] = []
  for (const relPath of canonicalFiles) {
    if (!fileExists(relPath)) {
      canonicalFileIssues.push(`${relPath} (missing)`)
      continue
    }
    const content = readUtf8(relPath)
    if (/dazrael\.com/i.test(content)) {
      canonicalFileIssues.push(`${relPath} (contains legacy domain)`)
    }
    if (!/raelinfo\.com/i.test(content)) {
      canonicalFileIssues.push(`${relPath} (missing raelinfo.com reference)`)
    }
  }
  if (canonicalFileIssues.length > 0) {
    push(results, 'canonical-domain-code', 'fail', canonicalFileIssues.join('; '))
  } else {
    push(results, 'canonical-domain-code', 'pass', 'Canonical domain references are aligned in critical files.')
  }

  const supportFile = 'lib/config/contact.ts'
  if (!fileExists(supportFile)) {
    push(results, 'support-email', 'fail', `${supportFile} is missing.`)
  } else {
    const supportContent = readUtf8(supportFile)
    if (!/support@raelinfo\.com/.test(supportContent)) {
      push(results, 'support-email', 'fail', 'SUPPORT_EMAIL is not support@raelinfo.com.')
    } else {
      push(results, 'support-email', 'pass', 'Support email is support@raelinfo.com.')
    }
  }

  const migrationDir = path.join(ROOT, 'supabase', 'migrations')
  if (!fs.existsSync(migrationDir)) {
    push(results, 'required-migrations', 'fail', 'supabase/migrations directory is missing.')
  } else {
    const migrationFiles = new Set(
      fs
        .readdirSync(migrationDir)
        .filter((file) => file.toLowerCase().endsWith('.sql'))
    )
    const missingMigrations = REQUIRED_MIGRATIONS.filter((name) => !migrationFiles.has(name))
    if (missingMigrations.length > 0) {
      push(results, 'required-migrations', 'fail', `Missing migrations: ${missingMigrations.join(', ')}`)
    } else {
      push(results, 'required-migrations', 'pass', 'Required migrations are present.')
    }
  }

  if (!fileExists('package.json')) {
    push(results, 'package-scripts', 'fail', 'package.json is missing.')
  } else {
    const packageJson = JSON.parse(readUtf8('package.json')) as {
      scripts?: Record<string, string>
    }
    const scripts = packageJson.scripts ?? {}
    const missingScripts = REQUIRED_SCRIPTS.filter((name) => typeof scripts[name] !== 'string' || scripts[name].trim().length === 0)
    const checkProductionScript = scripts['check:production']
    if (missingScripts.length > 0) {
      push(results, 'package-scripts', 'fail', `Missing scripts: ${missingScripts.join(', ')}`)
    } else if (checkProductionScript !== 'tsx scripts/production-readiness-check.ts') {
      push(
        results,
        'package-scripts',
        'fail',
        `check:production must be "tsx scripts/production-readiness-check.ts" (found "${checkProductionScript ?? ''}")`
      )
    } else {
      push(results, 'package-scripts', 'pass', 'Required npm scripts exist and check:production is configured.')
    }
  }

  const missingCriticalFiles = CRITICAL_FILES.filter((relPath) => !fileExists(relPath))
  if (missingCriticalFiles.length > 0) {
    push(results, 'critical-files', 'fail', `Missing files: ${missingCriticalFiles.join(', ')}`)
  } else {
    push(results, 'critical-files', 'pass', 'All critical routes/files exist.')
  }

  return results
}

function printReport(results: CheckResult[]): void {
  for (const result of results) {
    const icon = result.status === 'pass' ? 'PASS' : result.status === 'warn' ? 'WARN' : 'FAIL'
    console.log(`[${icon}] ${result.name}: ${result.details}`)
  }

  const passCount = results.filter((result) => result.status === 'pass').length
  const warnCount = results.filter((result) => result.status === 'warn').length
  const failCount = results.filter((result) => result.status === 'fail').length
  console.log(`\nSummary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed.`)
}

function main(): void {
  const results = runChecks()
  printReport(results)
  const failed = results.some((result) => result.status === 'fail')
  if (failed) {
    process.exit(1)
  }
}

main()
