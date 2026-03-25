export type ClientMappedErrorCode =
  | 'auth_required'
  | 'workspace_required'
  | 'plan_required'
  | 'forbidden'
  | 'not_found'
  | 'feature_disabled'
  | 'invalid_method'
  | 'temporary_unavailable'
  | 'unknown_error'

export type ClientMappedError = {
  code: ClientMappedErrorCode
  message: string
  requestId?: string
  nextAction?: { label: string; href: string }
}

function safeString(v: unknown): string {
  if (typeof v === 'string') return v
  return ''
}

export function mapApiErrorToClient(args: {
  res: Response
  json: unknown
}): ClientMappedError {
  const status = args.res.status
  const j = args.json as any
  const serverCode = safeString(j?.error?.code)
  const serverMessage = safeString(j?.error?.message) || 'Request failed'
  const requestId = safeString(j?.error?.requestId) || undefined
  const details = j?.error?.details as any

  const structuredCode = safeString(details?.code)

  const codeFromStatus: ClientMappedErrorCode =
    status === 401
      ? 'auth_required'
      : status === 403
        ? 'forbidden'
        : status === 404
          ? 'not_found'
          : status === 405
            ? 'invalid_method'
            : status === 503
              ? 'temporary_unavailable'
              : 'unknown_error'

  // Prefer explicit structured details code if present.
  const code: ClientMappedErrorCode =
    structuredCode === 'invalid_method'
      ? 'invalid_method'
      : serverCode === 'ASSISTANT_PLAN_REQUIRED'
        ? 'plan_required'
        : serverCode === 'ASSISTANT_WORKSPACE_REQUIRED'
          ? 'workspace_required'
          : serverCode === 'UNAUTHORIZED'
            ? 'auth_required'
            : serverCode === 'FORBIDDEN'
              ? 'forbidden'
              : serverCode === 'NOT_FOUND'
                ? 'not_found'
                : codeFromStatus

  const nextAction: ClientMappedError['nextAction'] =
    code === 'auth_required'
      ? { label: 'Sign in', href: '/login?mode=signin&redirect=/' }
      : code === 'plan_required'
        ? { label: 'View pricing', href: '/pricing' }
        : code === 'workspace_required'
          ? { label: 'Workspace settings', href: '/settings/workspace' }
          : code === 'forbidden'
            ? { label: 'Support', href: '/support' }
            : code === 'not_found'
              ? { label: 'Go to dashboard', href: '/dashboard' }
              : undefined

  return { code, message: serverMessage, requestId, nextAction }
}

