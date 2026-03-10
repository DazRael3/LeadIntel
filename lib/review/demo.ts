import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

type AdminAuthApi = {
  auth: {
    admin: {
      listUsers: () => Promise<{ data: { users: unknown[] } | null; error: { message?: string } | null }>
      createUser: (args: {
        email: string
        password: string
        email_confirm: boolean
        user_metadata?: Record<string, unknown>
      }) => Promise<{ data: { user?: { id?: string | null } | null } | null; error: { message?: string } | null }>
      updateUserById: (id: string, args: { user_metadata?: Record<string, unknown> }) => Promise<{ data: unknown; error: { message?: string } | null }>
    }
  }
}

function requireNonEmpty(name: string, v: string | undefined): string {
  const value = (v ?? '').trim()
  if (!value) throw new Error(`missing_env_${name.toLowerCase()}`)
  return value
}

function seedId(input: string): string {
  // Stable UUID v5-ish: SHA-1 truncated to 16 bytes.
  const hex = crypto.createHash('sha1').update(input, 'utf8').digest('hex').slice(0, 32)
  const parts = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)]
  return parts.join('-')
}

async function findAuthUserIdByEmail(admin: AdminClient, email: string): Promise<string | null> {
  try {
    // Supabase admin API pagination varies by version; use the simplest call and search results.
    const api = admin as unknown as AdminAuthApi
    const { data, error } = await api.auth.admin.listUsers()
    if (error) return null
    const users = (data?.users ?? []) as unknown[]
    for (const u of users) {
      if (!u || typeof u !== 'object') continue
      const row = u as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id : null
      const e = typeof row.email === 'string' ? row.email.toLowerCase() : null
      if (id && e === email.toLowerCase()) return id
    }
    return null
  } catch {
    return null
  }
}

export type ReviewDemoSetup = {
  demoUserId: string
  demoEmail: string
  demoWorkspaceId: string
}

export async function ensureReviewDemoSetup(): Promise<ReviewDemoSetup> {
  const demoEmail = requireNonEmpty('REVIEW_DEMO_EMAIL', process.env.REVIEW_DEMO_EMAIL)
  const demoPassword = requireNonEmpty('REVIEW_DEMO_PASSWORD', process.env.REVIEW_DEMO_PASSWORD)
  const workspaceName = (process.env.REVIEW_DEMO_WORKSPACE_NAME ?? 'LeadIntel Review Demo').trim() || 'LeadIntel Review Demo'

  const admin = createSupabaseAdminClient({ schema: 'api' })

  // 1) Ensure auth user exists.
  let demoUserId: string | null = await findAuthUserIdByEmail(admin, demoEmail)
  if (!demoUserId) {
    const api = admin as unknown as AdminAuthApi
    const { data, error } = await api.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { review_mode: true },
    })
    if (error || !data?.user?.id) {
      // If user already exists, fall back to lookup.
      demoUserId = await findAuthUserIdByEmail(admin, demoEmail)
      if (!demoUserId) throw new Error('review_demo_user_unavailable')
    } else {
      demoUserId = String(data.user.id)
    }
  }

  if (!demoUserId) throw new Error('review_demo_user_unavailable')
  const demoUserIdStr = demoUserId

  // Ensure review metadata is present even if the user already existed.
  try {
    const api = admin as unknown as AdminAuthApi
    await api.auth.admin.updateUserById(demoUserIdStr, { user_metadata: { review_mode: true } })
  } catch {
    // ignore
  }

  // 2) Ensure api.users row exists (best-effort, RLS bypass via service role).
  try {
    await admin
      .schema('api')
      .from('users')
      .upsert(
        {
          id: demoUserIdStr,
          email: demoEmail,
          subscription_tier: 'team',
          credits_remaining: 9999,
          last_credit_reset: new Date().toISOString(),
        } as never,
        { onConflict: 'id' }
      )
  } catch {
    // ignore (older schema)
    await admin.schema('api').from('users').upsert({ id: demoUserIdStr, email: demoEmail } as never, { onConflict: 'id' }).catch(() => undefined)
  }

  // 3) Ensure user_settings exists.
  await admin
    .schema('api')
    .from('user_settings')
    .upsert(
      {
        user_id: demoUserIdStr,
        display_name: 'LeadIntel Review',
        from_name: 'LeadIntel Review',
        from_email: demoEmail,
        onboarding_completed: true,
      } as never,
      { onConflict: 'user_id' }
    )
    .catch(() => undefined)

  // 4) Ensure demo workspace exists (owned by demo user so ensurePersonalWorkspace won’t create drift).
  const { data: existingWs } = await admin
    .schema('api')
    .from('workspaces')
    .select('id, name, owner_user_id, created_at')
    .eq('owner_user_id', demoUserIdStr)
    .eq('name', workspaceName)
    .limit(1)
    .maybeSingle()

  let demoWorkspaceId: string | null =
    typeof (existingWs as { id?: unknown } | null)?.id === 'string' ? String((existingWs as { id?: unknown } | null)?.id) : null
  if (!demoWorkspaceId) {
    const { data: ws, error } = await admin
      .schema('api')
      .from('workspaces')
      .insert({ name: workspaceName, owner_user_id: demoUserIdStr } as never)
      .select('id')
      .single()
    const inserted = (ws as { id?: unknown } | null)?.id
    if (error || !inserted || typeof inserted !== 'string') throw new Error('review_demo_workspace_unavailable')
    demoWorkspaceId = inserted
  }
  const demoWorkspaceIdStr = demoWorkspaceId

  // 5) Ensure membership (manager for broad read access; server enforces review read-only).
  await admin
    .schema('api')
    .from('workspace_members')
    .upsert(
      { workspace_id: demoWorkspaceIdStr, user_id: demoUserIdStr, role: 'manager', membership_source: 'direct' } as never,
      { onConflict: 'workspace_id,user_id' }
    )
    .catch(() => undefined)

  // 6) Ensure current workspace points at demo workspace for stable UX.
  await admin
    .schema('api')
    .from('users')
    .update({ current_workspace_id: demoWorkspaceIdStr } as never)
    .eq('id', demoUserIdStr)
    .catch(() => undefined)

  // 7) Seed fake data (idempotent).
  await seedReviewDemoData({ admin, demoUserId: demoUserIdStr, demoWorkspaceId: demoWorkspaceIdStr }).catch(() => undefined)

  return { demoUserId: demoUserIdStr, demoEmail, demoWorkspaceId: demoWorkspaceIdStr }
}

async function seedReviewDemoData(args: { admin: AdminClient; demoUserId: string; demoWorkspaceId: string }): Promise<void> {
  // If we already have demo-tagged leads, assume seeded.
  const { data: existing } = await args.admin
    .schema('api')
    .from('leads')
    .select('id')
    .eq('user_id', args.demoUserId)
    .ilike('company_domain', 'reviewdemo-%')
    .limit(1)

  if (Array.isArray(existing) && existing.length > 0) return

  const now = Date.now()
  const companies = [
    { name: 'ReviewDemo Robotics', domain: 'reviewdemo-robotics.example.com' },
    { name: 'ReviewDemo FinTech', domain: 'reviewdemo-fintech.example.com' },
    { name: 'ReviewDemo Health', domain: 'reviewdemo-health.example.com' },
    { name: 'ReviewDemo Cloud', domain: 'reviewdemo-cloud.example.com' },
    { name: 'ReviewDemo Retail', domain: 'reviewdemo-retail.example.com' },
  ]

  const leadRows = companies.map((c, idx) => {
    const id = seedId(`${args.demoWorkspaceId}:lead:${c.domain}`)
    return {
      id,
      user_id: args.demoUserId,
      company_url: `https://${c.domain}`,
      company_domain: c.domain,
      company_name: c.name,
      created_at: new Date(now - idx * 3 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - idx * 12 * 60 * 60 * 1000).toISOString(),
    }
  })

  await args.admin.schema('api').from('leads').insert(leadRows as never).catch(() => undefined)

  const triggerRows = leadRows.flatMap((l, idx) => {
    const base = now - idx * 24 * 60 * 60 * 1000
    return [
      {
        id: seedId(`${l.id}:t:funding`),
        user_id: args.demoUserId,
        lead_id: l.id,
        event_type: 'funding',
        company_name: l.company_name,
        company_domain: l.company_domain,
        company_url: l.company_url,
        headline: `${l.company_name} announces new funding round`,
        event_description: 'Public announcement detected. This is demo data for review only.',
        source_url: 'https://example.com/demo/funding',
        detected_at: new Date(base - 2 * 60 * 60 * 1000).toISOString(),
        payload: { demo: true, kind: 'funding' },
      },
      {
        id: seedId(`${l.id}:t:hiring`),
        user_id: args.demoUserId,
        lead_id: l.id,
        event_type: 'new_hires',
        company_name: l.company_name,
        company_domain: l.company_domain,
        company_url: l.company_url,
        headline: `${l.company_name} shows hiring spike`,
        event_description: 'Job postings increased. This is demo data for review only.',
        source_url: 'https://example.com/demo/hiring',
        detected_at: new Date(base - 8 * 60 * 60 * 1000).toISOString(),
        payload: { demo: true, kind: 'hiring' },
      },
    ]
  })

  await args.admin.schema('api').from('trigger_events').insert(triggerRows as never).catch(() => undefined)

  // Workspace-level account/program and queue entries (best-effort; table may not exist in older deployments).
  const programRows = leadRows.map((l, idx) => ({
    id: seedId(`${args.demoWorkspaceId}:program:${l.id}`),
    workspace_id: args.demoWorkspaceId,
    lead_id: l.id,
    account_domain: l.company_domain,
    account_name: l.company_name,
    program_state: idx === 0 ? 'strategic' : idx === 1 ? 'named' : 'standard',
    note: 'Seeded demo account program. Fake data only.',
    created_at: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - idx * 6 * 60 * 60 * 1000).toISOString(),
  }))
  await args.admin.schema('api').from('account_program_accounts').upsert(programRows as never, { onConflict: 'id' }).catch(() => undefined)

  const queueRows = leadRows.map((l, idx) => ({
    id: seedId(`${args.demoWorkspaceId}:queue:${l.id}`),
    workspace_id: args.demoWorkspaceId,
    created_by: args.demoUserId,
    lead_id: l.id,
    action_type: idx % 2 === 0 ? 'crm_handoff' : 'sequence_handoff',
    status: idx === 0 ? 'ready' : idx === 1 ? 'delivered' : 'queued',
    destination_type: 'webhook',
    destination_id: null,
    reason: null,
    error: null,
    payload_meta: { demo: true, companyName: l.company_name, companyDomain: l.company_domain },
    created_at: new Date(now - idx * 4 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - idx * 3 * 60 * 60 * 1000).toISOString(),
  }))
  await args.admin.schema('api').from('action_queue_items').upsert(queueRows as never, { onConflict: 'id' }).catch(() => undefined)
}

