type AuthUser = { id: string; email?: string | null }

type AuthResponse = { data: { user: AuthUser | null; session?: unknown | null }; error: null }

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

class E2EQuery<T = unknown> {
  private selectArgs: unknown[] | null = null
  private isCountQuery = false
  private forceSingle = false

  select(...args: unknown[]) {
    this.selectArgs = args
    // Heuristic: count queries used in codebase pass options object as 2nd arg
    if (args.length >= 2 && typeof args[1] === 'object' && args[1] && 'count' in (args[1] as object)) {
      this.isCountQuery = true
    }
    return this
  }
  eq() {
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
    return this
  }
  update() {
    return this
  }
  upsert() {
    return this
  }
  delete() {
    return this
  }

  private async execute(): Promise<any> {
    if (this.isCountQuery) {
      return { data: null, error: null, count: 0 }
    }

    // Provide minimal stable shapes for common selects
    if (this.forceSingle) {
      // Return null data (callers typically handle null and use defaults)
      return { data: null, error: null }
    }

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
    from: (_table: string) => new E2EQuery(),
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
    from: (_table: string) => new E2EQuery(),
  }
}


