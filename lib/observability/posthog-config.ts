type PosthogMode = 'disabled' | 'capture_only' | 'private_api' | 'capture_and_private_api' | 'misconfigured'

export type PosthogConfiguration = {
  mode: PosthogMode
  analyticsEnabled: boolean
  analyticsCaptureConfigured: boolean
  privateApiConfigured: boolean
  privateApiEnabled: boolean
  host: string | null
  projectId: string | null
  privateApiKey: string | null
  messages: string[]
}

function trimEnv(name: string): string {
  return (process.env[name] ?? '').trim()
}

function isEnabledFlag(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

function normalizeHost(rawHost: string): { host: string | null; error: string | null } {
  if (!rawHost) return { host: 'https://app.posthog.com', error: null }
  const withScheme = /^[a-z]+:\/\//i.test(rawHost) ? rawHost : `https://${rawHost}`
  try {
    const parsed = new URL(withScheme)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { host: null, error: 'NEXT_PUBLIC_POSTHOG_HOST must use http or https.' }
    }
    if (parsed.pathname && parsed.pathname !== '/') {
      return { host: null, error: 'NEXT_PUBLIC_POSTHOG_HOST must be an origin without a path.' }
    }
    return { host: parsed.origin, error: null }
  } catch {
    return { host: null, error: 'NEXT_PUBLIC_POSTHOG_HOST must be a valid URL.' }
  }
}

function isNumericProjectId(value: string): boolean {
  return /^[0-9]+$/.test(value)
}

function likelyPosthogApiKey(value: string): boolean {
  return value.startsWith('phx_') || value.startsWith('phc_') || value.length >= 16
}

export function getPosthogConfiguration(): PosthogConfiguration {
  const analyticsEnabled = isEnabledFlag(trimEnv('NEXT_PUBLIC_ANALYTICS_ENABLED'))
  const publicToken = trimEnv('NEXT_PUBLIC_POSTHOG_KEY')
  const hostRaw = trimEnv('NEXT_PUBLIC_POSTHOG_HOST') || trimEnv('POSTHOG_HOST')
  const projectId = trimEnv('POSTHOG_PROJECT_ID')
  const privateApiKey =
    trimEnv('POSTHOG_PERSONAL_API_KEY') || trimEnv('POSTHOG_API_KEY') || trimEnv('POSTHOG_PROJECT_API_KEY')

  const hostResult = normalizeHost(hostRaw)
  const messages: string[] = []

  if (hostResult.error) {
    messages.push(hostResult.error)
  }

  if (projectId.startsWith('phc_') || projectId.startsWith('phx_')) {
    messages.push(
      'POSTHOG_PROJECT_ID must be numeric. Use NEXT_PUBLIC_POSTHOG_KEY for the phc_/phx_ project token.'
    )
  } else if (projectId && !isNumericProjectId(projectId)) {
    messages.push('POSTHOG_PROJECT_ID must be numeric.')
  }

  if (analyticsEnabled && !publicToken) {
    messages.push('NEXT_PUBLIC_ANALYTICS_ENABLED is true but NEXT_PUBLIC_POSTHOG_KEY is missing.')
  }

  const privateApiEnabled = Boolean(projectId || privateApiKey)
  const privateApiConfigured = Boolean(projectId && isNumericProjectId(projectId) && privateApiKey)
  if (privateApiEnabled && !privateApiConfigured) {
    if (!projectId) messages.push('POSTHOG_PROJECT_ID is required for PostHog private API features.')
    if (!privateApiKey) {
      messages.push('POSTHOG_PERSONAL_API_KEY or POSTHOG_API_KEY is required for PostHog private API features.')
    }
  }

  const analyticsCaptureConfigured = Boolean(analyticsEnabled && publicToken && hostResult.host && !hostResult.error)

  if (privateApiConfigured && privateApiKey && !likelyPosthogApiKey(privateApiKey)) {
    messages.push('PostHog private API key appears malformed.')
  }

  const mode: PosthogMode = messages.length
    ? 'misconfigured'
    : analyticsCaptureConfigured && privateApiConfigured
      ? 'capture_and_private_api'
      : privateApiConfigured
        ? 'private_api'
        : analyticsCaptureConfigured
          ? 'capture_only'
          : 'disabled'

  return {
    mode,
    analyticsEnabled,
    analyticsCaptureConfigured,
    privateApiConfigured,
    privateApiEnabled,
    host: hostResult.host,
    projectId: projectId || null,
    privateApiKey: privateApiKey || null,
    messages,
  }
}

