type AuthUser = { id: string; email?: string | null }

type AuthResponse = { data: { user: AuthUser | null; session?: unknown | null }; error: null }

type PlanTier = 'free' | 'pro' | 'closer_plus' | 'team'

function getE2EUser(userId?: string | null, emailOverride?: string | null): AuthUser {
  return {
    id: (userId && userId.trim()) || 'e2e-user-id',
    email: (emailOverride && emailOverride.trim()) || process.env.E2E_EMAIL || process.env.E2E_TEAM_EMAIL || process.env.E2E_TEST_USER_EMAIL || null,
  }
}

function getBrowserCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\\\$&')}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

type UserWatchlistRow = {
  user_id: string
  kind: 'stock' | 'crypto'
  symbol: string
  display_name: string
  sort_order: number
}

type AnyRow = Record<string, unknown>

const globalTableKey = '__leadintelE2ETableStore'
function getTableStore(): Map<string, AnyRow[]> {
  const g = globalThis as unknown as Record<string, unknown>
  const existing = g[globalTableKey]
  if (existing instanceof Map) return existing as Map<string, AnyRow[]>
  const next = new Map<string, AnyRow[]>()
  g[globalTableKey] = next
  return next
}

function randomUuid(): string {
  // Best-effort UUID v4 (works in Node + browsers).
  const g = globalThis as unknown as { crypto?: { getRandomValues?: (arr: Uint8Array) => void; randomUUID?: () => string } }
  if (g.crypto?.randomUUID) return g.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // Per RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

function tableKey(table: string): string {
  return `t:${table}`
}

function readRows(table: string): AnyRow[] {
  const store = getTableStore()
  return store.get(tableKey(table)) ?? []
}

function writeRows(table: string, rows: AnyRow[]): void {
  const store = getTableStore()
  store.set(tableKey(table), rows)
}

const globalWatchlistKey = '__leadintelE2EUserWatchlists'
function getWatchlistStore(): Map<string, UserWatchlistRow[]> {
  const g = globalThis as unknown as Record<string, unknown>
  const existing = g[globalWatchlistKey]
  if (existing instanceof Map) return existing as Map<string, UserWatchlistRow[]>
  const next = new Map<string, UserWatchlistRow[]>()
  g[globalWatchlistKey] = next
  return next
}

function getPlanFromCookie(getCookie: (name: string) => string | null | undefined): PlanTier {
  const raw = (getCookie('li_e2e_plan') || '').toLowerCase()
  if (raw === 'team') return 'team'
  if (raw === 'closer_plus') return 'closer_plus'
  if (raw === 'pro') return 'pro'
  return 'free'
}

function matchesFilters(row: AnyRow, filters: Record<string, unknown>): boolean {
  return Object.entries(filters).every(([key, filter]) => {
    const raw = row[key]
    if (filter && typeof filter === 'object' && 'op' in (filter as { op?: unknown })) {
      const op = String((filter as { op?: unknown }).op ?? '')
      const val = (filter as { value?: unknown }).value
      if (op === 'eq' || op === 'is') return raw === val
      if (op === 'gte') return String(raw ?? '') >= String(val ?? '')
      if (op === 'lte') return String(raw ?? '') <= String(val ?? '')
      if (op === 'in') return Array.isArray(val) && val.includes(raw)
      return true
    }
    return raw === filter
  })
}

class E2EQuery<T = unknown> {
  private table: string
  private ctx: { userId: string; plan: PlanTier }
  private selectArgs: unknown[] | null = null
  private isCountQuery = false
  private forceSingle = false
  private mode: 'select' | 'delete' | 'insert' | 'update' | 'upsert' = 'select'
  private filters: Record<string, unknown> = {}
  private orderBy: { col: string; asc: boolean } | null = null
  private pendingRows: unknown[] | null = null
  private updatePatch: AnyRow | null = null

  constructor(table: string, ctx: { userId: string; plan: PlanTier }) {
    this.table = table
    this.ctx = ctx
  }

  select(...args: unknown[]) {
    this.selectArgs = args
    // Heuristic: count queries used in codebase pass options object as 2nd arg
    if (args.length >= 2 && typeof args[1] === 'object' && args[1] && 'count' in (args[1] as object)) {
      this.isCountQuery = true
    }
    return this
  }
  eq(column?: string, value?: unknown) {
    if (column) this.filters[column] = { op: 'eq', value }
    return this
  }
  is(column?: string, value?: unknown) {
    if (column) this.filters[column] = { op: 'is', value }
    return this
  }
  in(column?: string, values?: unknown[]) {
    if (column) this.filters[column] = { op: 'in', value: Array.isArray(values) ? values : [] }
    return this
  }
  not() {
    return this
  }
  gte(column?: string, value?: unknown) {
    if (column) this.filters[column] = { op: 'gte', value }
    return this
  }
  lte(column?: string, value?: unknown) {
    if (column) this.filters[column] = { op: 'lte', value }
    return this
  }
  order() {
    const col = arguments[0] as string | undefined
    const opts = arguments[1] as { ascending?: boolean } | undefined
    if (col) this.orderBy = { col, asc: opts?.ascending !== false }
    return this
  }
  limit() {
    return this
  }
  maybeSingle() {
    this.forceSingle = true
    return this
  }
  single() {
    this.forceSingle = true
    return this
  }
  insert() {
    this.mode = 'insert'
    this.pendingRows = Array.isArray(arguments[0]) ? (arguments[0] as unknown[]) : [arguments[0]]
    return this
  }
  update() {
    this.mode = 'update'
    this.updatePatch = (arguments[0] as AnyRow) ?? null
    return this
  }
  upsert() {
    this.mode = 'upsert'
    this.pendingRows = Array.isArray(arguments[0]) ? (arguments[0] as unknown[]) : [arguments[0]]
    return this
  }
  delete() {
    this.mode = 'delete'
    return this
  }

  private async execute(): Promise<any> {
    // Count queries (head: true) are used by activation and other surfaces.
    if (this.isCountQuery) {
      const rows = readRows(this.table)
      const filtered = rows.filter((r) => matchesFilters(r, this.filters))
      return { data: null, error: null, count: filtered.length }
    }

    // Users table: persistent in-memory rows with cookie-driven tier override.
    if (this.table === 'users') {
      const nowIso = new Date().toISOString()
      const base = {
        id: this.ctx.userId,
        subscription_tier: this.ctx.plan,
        stripe_customer_id: 'cus_e2e',
        last_unlock_date: null,
        created_at: nowIso,
        updated_at: nowIso,
      }
      let rows = readRows(this.table)
      const idx = rows.findIndex((row) => String(row.id ?? '') === this.ctx.userId)
      if (idx >= 0) {
        rows[idx] = {
          ...base,
          ...rows[idx],
          subscription_tier: this.ctx.plan,
          updated_at: nowIso,
        }
      } else {
        rows = rows.concat(base)
      }
      const match = (row: AnyRow): boolean => matchesFilters(row, this.filters)

      if (this.mode === 'delete') {
        rows = rows.filter((row) => !match(row))
        writeRows(this.table, rows)
        return { data: null, error: null }
      }

      if (this.mode === 'update') {
        const patch = this.updatePatch ?? {}
        rows = rows.map((row) => (match(row) ? { ...row, ...patch, updated_at: nowIso } : row))
        writeRows(this.table, rows)
        const updated = rows.filter((row) => match(row))
        if (this.forceSingle) return { data: updated[0] ?? null, error: null }
        return { data: updated, error: null }
      }

      if (this.mode === 'insert' || this.mode === 'upsert') {
        const inserted = (this.pendingRows ?? []).map((row) => {
          const next = { ...(row as AnyRow) }
          if (!next.id) next.id = randomUuid()
          if (!next.subscription_tier) next.subscription_tier = this.ctx.plan
          if (!next.created_at) next.created_at = nowIso
          next.updated_at = nowIso
          return next
        })
        if (this.mode === 'upsert') {
          for (const next of inserted) {
            const id = String(next.id ?? '')
            rows = rows.filter((row) => String(row.id ?? '') !== id)
            rows.push(next)
          }
        } else {
          rows = rows.concat(inserted)
        }
        writeRows(this.table, rows)
        if (this.forceSingle) return { data: inserted[0] ?? null, error: null }
        return { data: inserted, error: null }
      }

      writeRows(this.table, rows)
      const selected = rows.filter((row) => match(row))
      if (this.forceSingle) return { data: selected[0] ?? null, error: null }
      return { data: selected, error: null }
    }

    // Market watchlist: persistent per test user id.
    if (this.table === 'user_watchlists') {
      const store = getWatchlistStore()
      const owner = (this.filters.user_id as string | undefined) || this.ctx.userId
      const existing = store.get(owner) ?? []

      if (this.mode === 'delete') {
        const kind = this.filters.kind as ('stock' | 'crypto') | undefined
        const symbol = this.filters.symbol as string | undefined
        if (kind && symbol) {
          store.set(
            owner,
            existing.filter((r) => !(r.kind === kind && r.symbol === symbol))
          )
        } else {
          store.set(owner, [])
        }
        return { data: null, error: null }
      }
      if (this.mode === 'insert' || this.mode === 'upsert') {
        const rows = (this.pendingRows ?? []).map((r) => r as UserWatchlistRow)
        let next = existing.slice()
        for (const row of rows) {
          next = next.filter((r) => !(r.kind === row.kind && r.symbol === row.symbol))
          next.push(row)
        }
        store.set(owner, next)
        return { data: null, error: null }
      }

      let rows = existing.slice()
      if (this.orderBy?.col === 'sort_order') {
        rows.sort((a, b) => (this.orderBy?.asc ? a.sort_order - b.sort_order : b.sort_order - a.sort_order))
      }
      if (this.forceSingle) return { data: rows[0] ?? null, error: null }
      return { data: rows, error: null }
    }

    // Generic in-memory tables used across the app.
    if (
      this.table === 'user_settings' ||
      this.table === 'leads' ||
      this.table === 'pitches' ||
      this.table === 'workspaces' ||
      this.table === 'workspace_members' ||
      this.table === 'workspace_invites' ||
      this.table === 'template_sets' ||
      this.table === 'templates' ||
      this.table === 'audit_logs' ||
      this.table === 'trigger_events' ||
      this.table === 'demo_sessions' ||
      this.table === 'campaigns' ||
      this.table === 'campaign_leads' ||
      this.table === 'subscriptions' ||
      this.table === 'webhook_endpoints' ||
      this.table === 'webhook_deliveries' ||
      this.table === 'export_jobs'
    ) {
      let rows = readRows(this.table)
      const match = (r: AnyRow): boolean => matchesFilters(r, this.filters)

      if (this.mode === 'delete') {
        rows = rows.filter((r) => !match(r))
        writeRows(this.table, rows)
        return { data: null, error: null }
      }

      if (this.mode === 'update') {
        const patch = this.updatePatch ?? {}
        rows = rows.map((r) => (match(r) ? { ...r, ...patch } : r))
        writeRows(this.table, rows)
        const updated = rows.filter((r) => match(r))
        if (this.forceSingle) return { data: updated[0] ?? null, error: null }
        return { data: updated, error: null }
      }

      if (this.mode === 'insert' || this.mode === 'upsert') {
        const inserted = (this.pendingRows ?? []).map((r) => {
          const row = { ...(r as AnyRow) }
          if (!row.id) row.id = randomUuid()
          if (this.table === 'user_settings') {
            if (!row.user_id) row.user_id = this.ctx.userId
          }
          if (this.table === 'leads') {
            if (!row.user_id) row.user_id = this.ctx.userId
            if (!row.created_at) row.created_at = new Date().toISOString()
            if (!row.updated_at) row.updated_at = row.created_at
          }
          if (this.table === 'pitches') {
            if (!row.user_id) row.user_id = this.ctx.userId
            if (!row.created_at) row.created_at = new Date().toISOString()
          }
          if (this.table === 'workspaces') {
            if (!row.created_at) row.created_at = new Date().toISOString()
          }
          if (this.table === 'workspace_members') {
            if (!row.created_at) row.created_at = new Date().toISOString()
          }
          if (this.table === 'audit_logs') {
            if (!row.created_at) row.created_at = new Date().toISOString()
          }
          if (this.table === 'trigger_events') {
            if (!row.created_at) row.created_at = new Date().toISOString()
          }
          if (this.table === 'demo_sessions') {
            if (!row.created_at) row.created_at = new Date().toISOString()
          }
          if (this.table === 'campaigns') {
            if (!row.created_at) row.created_at = new Date().toISOString()
            if (!row.updated_at) row.updated_at = row.created_at
          }
          if (this.table === 'campaign_leads') {
            if (!row.created_at) row.created_at = new Date().toISOString()
          }
          if (this.table === 'subscriptions') {
            if (!row.created_at) row.created_at = new Date().toISOString()
            if (!row.updated_at) row.updated_at = row.created_at
          }
          if (this.table === 'webhook_deliveries') {
            if (!row.created_at) row.created_at = new Date().toISOString()
            if (!row.updated_at) row.updated_at = row.created_at
          }
          if (this.table === 'export_jobs') {
            if (!row.created_at) row.created_at = new Date().toISOString()
          }
          return row
        })
        if (this.mode === 'upsert') {
          // Minimal conflict handling for common tables.
          if (this.table === 'user_settings') {
            for (const ins of inserted) {
              const userId = String(ins.user_id ?? '')
              rows = rows.filter((r) => String(r.user_id ?? '') !== userId)
              rows.push(ins)
            }
          } else if (this.table === 'workspace_members') {
            for (const ins of inserted) {
              const ws = String(ins.workspace_id ?? '')
              const uid = String(ins.user_id ?? '')
              rows = rows.filter((r) => !(String(r.workspace_id ?? '') === ws && String(r.user_id ?? '') === uid))
              rows.push(ins)
            }
          } else if (this.table === 'demo_sessions') {
            for (const ins of inserted) {
              const tokenHash = String(ins.token_hash ?? '')
              rows = rows.filter((r) => String(r.token_hash ?? '') !== tokenHash)
              rows.push(ins)
            }
          } else if (this.table === 'campaign_leads') {
            for (const ins of inserted) {
              const campaignId = String(ins.campaign_id ?? '')
              const leadId = String(ins.lead_id ?? '')
              rows = rows.filter(
                (r) => !(String(r.campaign_id ?? '') === campaignId && String(r.lead_id ?? '') === leadId)
              )
              rows.push(ins)
            }
          } else if (this.table === 'campaigns' || this.table === 'subscriptions') {
            for (const ins of inserted) {
              const id = String(ins.id ?? '')
              rows = rows.filter((r) => String(r.id ?? '') !== id)
              rows.push(ins)
            }
          } else {
            rows = rows.concat(inserted)
          }
        } else {
          rows = rows.concat(inserted)
        }
        writeRows(this.table, rows)
        if (this.forceSingle) return { data: inserted[0] ?? null, error: null }
        return { data: inserted, error: null }
      }

      // select
      let selected = rows.filter((r) => match(r))
      if (this.orderBy) {
        selected = selected.slice().sort((a, b) => {
          const av = a[this.orderBy!.col]
          const bv = b[this.orderBy!.col]
          if (av === bv) return 0
          const cmp = String(av ?? '').localeCompare(String(bv ?? ''))
          return this.orderBy!.asc ? cmp : -cmp
        })
      }
      if (this.forceSingle) return { data: selected[0] ?? null, error: null }
      return { data: selected, error: null }
    }

    // Default: behave like before (empty results).
    if (this.forceSingle) return { data: null, error: null }
    return { data: [], error: null }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }
}

/**
 * E2E-only fake Supabase clients.
 *
 * This allows Playwright tests to run without a live Supabase project.
 * IMPORTANT: Authentication is simulated via a cookie set by the browser client:
 * `li_e2e_auth=1`.
 */
export function createE2EBrowserSupabaseClient(): any {
  const client: any = {
    auth: {
      getUser: async (): Promise<AuthResponse> => {
        const authed = typeof document !== 'undefined' && document.cookie.includes('li_e2e_auth=1')
        const uid = getBrowserCookie('li_e2e_uid')
        const email = getBrowserCookie('li_e2e_email')
        return { data: { user: authed ? getE2EUser(uid, email) : null }, error: null }
      },
      onAuthStateChange: (callback: (event: string, session: any) => void) => {
        // Minimal compatibility for components that subscribe to auth changes.
        // We don't attempt to simulate real refresh behavior; we just emit current state once.
        const authed = typeof document !== 'undefined' && document.cookie.includes('li_e2e_auth=1')
        const uid = getBrowserCookie('li_e2e_uid')
        const email = getBrowserCookie('li_e2e_email')
        const user = authed ? getE2EUser(uid, email) : null
        const session = user ? { user, access_token: 'e2e' } : null
        setTimeout(() => {
          callback(authed ? 'SIGNED_IN' : 'SIGNED_OUT', session)
        }, 0)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      signInWithPassword: async () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'li_e2e_auth=1; path=/'
        }
        const user = getE2EUser(getBrowserCookie('li_e2e_uid'), getBrowserCookie('li_e2e_email'))
        return { data: { user, session: { access_token: 'e2e', user } }, error: null }
      },
      signUp: async () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'li_e2e_auth=1; path=/'
        }
        const user = getE2EUser(getBrowserCookie('li_e2e_uid'), getBrowserCookie('li_e2e_email'))
        return { data: { user, session: { access_token: 'e2e', user } }, error: null }
      },
      signOut: async () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'li_e2e_auth=; Max-Age=0; path=/'
        }
        return { error: null }
      },
      exchangeCodeForSession: async () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'li_e2e_auth=1; path=/'
        }
        const user = getE2EUser(getBrowserCookie('li_e2e_uid'))
        return { data: { user, session: { access_token: 'e2e', user } }, error: null }
      },
    },
    from: (table: string) => {
      const uid = getBrowserCookie('li_e2e_uid') || 'e2e-user-id'
      const plan = getPlanFromCookie((name) => getBrowserCookie(name))
      return new E2EQuery(table, { userId: uid, plan })
    },
    rpc: async () => {
      // Browser-side RPC is not needed for current E2E flows.
      return { data: null, error: null }
    },
  }
  // Supabase JS supports `supabase.schema('api').from('table')`.
  // In E2E shim, schema is a no-op (tables are already modeled without schema prefix).
  client.schema = (_schema: string) => client
  return client
}

export function createE2EServerSupabaseClient(args: { getCookie: (name: string) => string | undefined }): any {
  const client: any = {
    auth: {
      getUser: async (): Promise<AuthResponse> => {
        const authed = args.getCookie('li_e2e_auth') === '1'
        const uid = args.getCookie('li_e2e_uid')
        const email = args.getCookie('li_e2e_email') ?? null
        return { data: { user: authed ? getE2EUser(uid, email) : null }, error: null }
      },
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {
      const uid = args.getCookie('li_e2e_uid') || 'e2e-user-id'
      const plan = getPlanFromCookie((name) => args.getCookie(name))
      return new E2EQuery(table, { userId: uid, plan })
    },
    rpc: async (fn: string, params?: Record<string, unknown>) => {
      // Minimal RPC surface for team governance flows.
      const authed = args.getCookie('li_e2e_auth') === '1'
      const uid = args.getCookie('li_e2e_uid') || 'e2e-user-id'
      const email = String(args.getCookie('li_e2e_email') ?? '').trim().toLowerCase()
      if (!authed) return { data: null, error: { message: 'Authentication required' } }

      const sha256 = async (s: string): Promise<string> => {
        const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto
        const subtle = cryptoObj?.subtle
        if (!subtle) {
          // Fallback for environments without WebCrypto (should be rare in supported Node/browsers).
          let out = 0
          for (let i = 0; i < s.length; i++) out = (out * 31 + s.charCodeAt(i)) >>> 0
          return String(out)
        }
        const data = new TextEncoder().encode(s)
        const digest = await subtle.digest('SHA-256', data)
        const bytes = new Uint8Array(digest)
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      }

      if (fn === 'accept_workspace_invite') {
        const token = String((params ?? {}).p_token ?? '')
        const tokenHash = await sha256(token)
        const invites = readRows('workspace_invites')
        const now = Date.now()
        const inv = invites.find((r) => {
          const expiresAt = Date.parse(String(r.expires_at ?? ''))
          const okExpires = Number.isFinite(expiresAt) && expiresAt > now
          const okEmail = email ? String(r.email ?? '').toLowerCase() === email : true
          return String(r.token_hash ?? '') === tokenHash && !r.accepted_at && okExpires && okEmail
        })
        if (!inv) return { data: null, error: { message: 'Invalid or expired invite' } }
        const workspaceId = String(inv.workspace_id)
        const members = readRows('workspace_members')
        if (!members.some((m) => String(m.workspace_id) === workspaceId && String(m.user_id) === uid)) {
          members.push({
            workspace_id: workspaceId,
            user_id: uid,
            role: String(inv.role ?? 'member'),
            created_at: new Date().toISOString(),
          })
          writeRows('workspace_members', members)
        }
        const nextInvites = invites.map((r) =>
          String(r.id) === String(inv.id)
            ? { ...r, accepted_at: new Date().toISOString(), accepted_by: uid }
            : r
        )
        writeRows('workspace_invites', nextInvites)
        return { data: workspaceId, error: null }
      }

      if (fn === 'set_workspace_member_role') {
        const workspaceId = String((params ?? {}).p_workspace_id ?? '')
        const userId = String((params ?? {}).p_user_id ?? '')
        const role = String((params ?? {}).p_role ?? '')
        const members = readRows('workspace_members')
        const actor = members.find((m) => String(m.workspace_id) === workspaceId && String(m.user_id) === uid)
        if (!actor) return { data: null, error: { message: 'Access restricted' } }
        if (role === 'owner' && actor.role !== 'owner') return { data: null, error: { message: 'Access restricted' } }
        const next = members.map((m) =>
          String(m.workspace_id) === workspaceId && String(m.user_id) === userId ? { ...m, role } : m
        )
        writeRows('workspace_members', next)
        const ws = readRows('workspaces')
        if (role === 'owner') {
          writeRows(
            'workspaces',
            ws.map((w) => (String(w.id) === workspaceId ? { ...w, owner_user_id: userId } : w))
          )
        }
        return { data: null, error: null }
      }

      if (fn === 'remove_workspace_member') {
        const workspaceId = String((params ?? {}).p_workspace_id ?? '')
        const userId = String((params ?? {}).p_user_id ?? '')
        const members = readRows('workspace_members')
        const actor = members.find((m) => String(m.workspace_id) === workspaceId && String(m.user_id) === uid)
        if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) return { data: null, error: { message: 'Access restricted' } }
        writeRows(
          'workspace_members',
          members.filter((m) => !(String(m.workspace_id) === workspaceId && String(m.user_id) === userId))
        )
        return { data: null, error: null }
      }

      return { data: null, error: { message: 'RPC not implemented' } }
    },
  }
  client.schema = (_schema: string) => client
  return client
}


