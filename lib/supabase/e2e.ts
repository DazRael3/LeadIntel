type AuthUser = { id: string; email?: string | null }

type AuthResponse = { data: { user: AuthUser | null; session?: unknown | null }; error: null }

type PlanTier = 'free' | 'pro'

function getE2EUser(userId?: string | null): AuthUser {
  return {
    id: (userId && userId.trim()) || 'e2e-user-id',
    email: process.env.E2E_TEST_USER_EMAIL || 'e2e-test@example.com',
  }
}

function getBrowserCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\\\$&')}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

type WatchlistSymbolRow = {
  user_id: string
  symbol: string
  instrument_type: 'stock' | 'crypto'
  position: number
}

const globalWatchlistKey = '__leadintelE2EWatchlistSymbols'
function getWatchlistStore(): Map<string, WatchlistSymbolRow[]> {
  const g = globalThis as unknown as Record<string, unknown>
  const existing = g[globalWatchlistKey]
  if (existing instanceof Map) return existing as Map<string, WatchlistSymbolRow[]>
  const next = new Map<string, WatchlistSymbolRow[]>()
  g[globalWatchlistKey] = next
  return next
}

function getPlanFromCookie(getCookie: (name: string) => string | null | undefined): PlanTier {
  const raw = (getCookie('li_e2e_plan') || '').toLowerCase()
  return raw === 'pro' ? 'pro' : 'free'
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
    if (column) this.filters[column] = value
    return this
  }
  in() {
    return this
  }
  not() {
    return this
  }
  gte() {
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
    return this
  }
  upsert() {
    this.mode = 'upsert'
    return this
  }
  delete() {
    this.mode = 'delete'
    return this
  }

  private async execute(): Promise<any> {
    if (this.isCountQuery) {
      return { data: null, error: null, count: 0 }
    }

    // Users table: provide subscription_tier (drives plan gating in UI/API).
    if (this.table === 'users') {
      const row = {
        id: this.ctx.userId,
        subscription_tier: this.ctx.plan,
        stripe_customer_id: 'cus_e2e',
        last_unlock_date: null,
      }
      if (this.forceSingle) return { data: row, error: null }
      return { data: [row], error: null }
    }

    // Market watchlist symbols: persistent per test user id.
    if (this.table === 'watchlist_symbols') {
      const store = getWatchlistStore()
      const owner = (this.filters.user_id as string | undefined) || this.ctx.userId
      const existing = store.get(owner) ?? []

      if (this.mode === 'delete') {
        store.set(owner, [])
        return { data: null, error: null }
      }
      if (this.mode === 'insert') {
        const rows = (this.pendingRows ?? []).map((r) => r as WatchlistSymbolRow)
        store.set(owner, rows)
        return { data: null, error: null }
      }

      let rows = existing.slice()
      if (this.orderBy?.col === 'position') {
        rows.sort((a, b) => (this.orderBy?.asc ? a.position - b.position : b.position - a.position))
      }
      if (this.forceSingle) return { data: rows[0] ?? null, error: null }
      return { data: rows, error: null }
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
  return {
    auth: {
      getUser: async (): Promise<AuthResponse> => {
        const authed = typeof document !== 'undefined' && document.cookie.includes('li_e2e_auth=1')
        const uid = getBrowserCookie('li_e2e_uid')
        return { data: { user: authed ? getE2EUser(uid) : null }, error: null }
      },
      signInWithPassword: async () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'li_e2e_auth=1; path=/'
        }
        const user = getE2EUser(getBrowserCookie('li_e2e_uid'))
        return { data: { user, session: { access_token: 'e2e' } }, error: null }
      },
      signUp: async () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'li_e2e_auth=1; path=/'
        }
        const user = getE2EUser(getBrowserCookie('li_e2e_uid'))
        return { data: { user, session: { access_token: 'e2e' } }, error: null }
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
        return { data: { user, session: { access_token: 'e2e' } }, error: null }
      },
    },
    from: (table: string) => {
      const uid = getBrowserCookie('li_e2e_uid') || 'e2e-user-id'
      const plan = getPlanFromCookie((name) => getBrowserCookie(name))
      return new E2EQuery(table, { userId: uid, plan })
    },
  }
}

export function createE2EServerSupabaseClient(args: { getCookie: (name: string) => string | undefined }): any {
  return {
    auth: {
      getUser: async (): Promise<AuthResponse> => {
        const authed = args.getCookie('li_e2e_auth') === '1'
        const uid = args.getCookie('li_e2e_uid')
        return { data: { user: authed ? getE2EUser(uid) : null }, error: null }
      },
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {
      const uid = args.getCookie('li_e2e_uid') || 'e2e-user-id'
      const plan = getPlanFromCookie((name) => args.getCookie(name))
      return new E2EQuery(table, { userId: uid, plan })
    },
  }
}


