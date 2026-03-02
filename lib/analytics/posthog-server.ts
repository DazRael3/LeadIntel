import { PostHog } from 'posthog-node'

let client: PostHog | null = null

function isEnabled(): boolean {
  const enabled = (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED ?? '').trim().toLowerCase()
  return enabled === 'true' || enabled === '1'
}

export function getPostHogServerClient(): PostHog | null {
  if (!isEnabled()) return null
  if (client) return client
  const key = (process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '').trim()
  if (!key) return null
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '').trim() || 'https://app.posthog.com'
  client = new PostHog(key, { host })
  return client
}

export async function captureServerEvent(args: {
  distinctId: string
  event: string
  properties?: Record<string, unknown>
}): Promise<void> {
  const ph = getPostHogServerClient()
  if (!ph) return
  try {
    ph.capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: args.properties ?? {},
    })
  } catch {
    // best-effort
  }
}

