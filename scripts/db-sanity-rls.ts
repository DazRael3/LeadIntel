/**
 * DB sanity check for RLS + grants (manual/staging/prod).
 *
 * This script is intentionally NOT run in CI because it requires real Supabase credentials.
 *
 * Usage:
 *   RUN_DB_SANITY=1 NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:sanity
 *
 * Notes:
 * - Uses the api schema by default.
 * - Creates two temporary users, signs them in, and verifies they cannot read/write each other's rows.
 * - Uses service role client to verify cross-tenant insert capability (webhook/cron model).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

type Row = Record<string, unknown>

async function must<T>(p: Promise<{ data: T; error: any }>, label: string): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(`${label}: ${error.message || String(error)}`)
  return data
}

async function createTempUser(admin: SupabaseClient, email: string, password: string): Promise<string> {
  const data = await must(
    admin.auth.admin.createUser({ email, password, email_confirm: true }),
    'createUser'
  )
  return data.user.id
}

async function signIn(anon: SupabaseClient, email: string, password: string): Promise<string> {
  const data = await must(anon.auth.signInWithPassword({ email, password }), 'signInWithPassword')
  if (!data.session?.access_token) throw new Error('missing access_token')
  return data.session.access_token
}

function authClient(url: string, anonKey: string, jwt: string, schema: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    db: { schema },
  })
}

async function expectCannotSelect(client: SupabaseClient, table: string, label: string) {
  const { error } = await client.from(table).select('*').limit(1)
  if (!error) {
    throw new Error(`${label}: expected SELECT to be blocked by RLS/grants`)
  }
}

async function main() {
  if (process.env.RUN_DB_SANITY !== '1') {
    console.log('[db-sanity] RUN_DB_SANITY!=1, skipping')
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url) throw new Error('Missing env NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)')
  if (!anonKey) throw new Error('Missing env NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const schema = process.env.SUPABASE_DB_SCHEMA || 'api'

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  })
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  })

  const password = 'TempPassword!12345'
  const u1Email = `rls_u1_${Date.now()}@example.com`
  const u2Email = `rls_u2_${Date.now()}@example.com`

  const u1 = await createTempUser(admin, u1Email, password)
  const u2 = await createTempUser(admin, u2Email, password)

  const u1Jwt = await signIn(anon, u1Email, password)
  const u2Jwt = await signIn(anon, u2Email, password)

  const c1 = authClient(url, anonKey, u1Jwt, schema)
  const c2 = authClient(url, anonKey, u2Jwt, schema)

  // Inserts should be allowed only for own user_id columns.
  await must(
    c1.from('feature_flags').upsert({ user_id: u1, feature: 'clearbit_enrichment', enabled: false }, { onConflict: 'user_id,feature' }),
    'u1 upsert feature_flags'
  )

  // Cross-tenant read should be blocked (RLS).
  await expectCannotSelect(c2, 'feature_flags', 'u2 reading feature_flags')

  // Cross-tenant write should be blocked (RLS with check).
  const { error: crossInsertErr } = await c2
    .from('feature_flags')
    .insert({ user_id: u1, feature: 'zapier_push', enabled: false } as Row)
  if (!crossInsertErr) {
    throw new Error('expected cross-tenant insert to be blocked')
  }

  // Service role can write cross-tenant (webhook/cron model), but must set user_id explicitly.
  await must(
    admin.from('email_engagement').insert({
      user_id: u1,
      lead_id: null,
      provider: 'resend',
      provider_message_id: `msg_${Date.now()}`,
      event_type: 'delivered',
      occurred_at: new Date().toISOString(),
    } as Row),
    'service role insert email_engagement'
  )

  console.log('[db-sanity] OK', { schema, u1, u2 })
}

main().catch((err) => {
  console.error('[db-sanity] FAILED', { message: err instanceof Error ? err.message : String(err) })
  process.exitCode = 1
})

