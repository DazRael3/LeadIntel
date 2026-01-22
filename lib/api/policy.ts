/**
 * Centralized API Security Policy
 * 
 * Defines security policies for all API routes including:
 * - Rate limiting (authenticated vs unauthenticated)
 * - Request size limits
 * - Origin validation requirements
 * - Authentication requirements
 * - Dev-only restrictions
 * - Webhook signature requirements
 */

export interface RoutePolicy {
  /** Security tier name for logging */
  tier: string
  /** Maximum request body size in bytes */
  maxBytes: number
  /** Rate limit configuration */
  rateLimit: {
    /** Authenticated requests per minute */
    authPerMin: number
    /** Unauthenticated (IP-based) requests per minute */
    ipPerMin: number
  }
  /** Whether origin validation is required */
  originRequired: boolean
  /** Whether Supabase authentication is required */
  authRequired: boolean
  /** Whether the route can be called by an authenticated cron/scheduler */
  cronAllowed: boolean
  /** Whether route is dev-only (blocked in production) */
  devOnly: boolean
  /** Whether webhook signature verification is required */
  webhookSignatureRequired: boolean
}

/**
 * Default policy for unknown routes (safe defaults)
 */
const DEFAULT_POLICY: RoutePolicy = {
  tier: 'UNKNOWN',
  maxBytes: 1024 * 1024, // 1MB
  rateLimit: {
    authPerMin: 30,
    ipPerMin: 10,
  },
  originRequired: true,
  authRequired: true, // All internal endpoints require auth by default
  cronAllowed: false,
  devOnly: false,
  webhookSignatureRequired: false,
}

/**
 * Route policy mapping
 * Maps route pathname + method to security policy
 * Only includes routes that actually exist (have route.ts files)
 */
const ROUTE_POLICIES: Record<string, RoutePolicy> = {
  // Tier A: AI/cost-heavy routes
  'POST:/api/generate-pitch': {
    tier: 'AI_GENERATION',
    maxBytes: 65536, // 64KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/generate-sequence': {
    tier: 'AI_GENERATION',
    maxBytes: 65536, // 64KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/generate-battle-card': {
    tier: 'AI_GENERATION',
    maxBytes: 65536, // 64KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/generate-linkedin-comment': {
    tier: 'AI_GENERATION',
    maxBytes: 65536, // 64KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/reveal': {
    tier: 'AI_GENERATION',
    maxBytes: 65536, // 64KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/unlock-lead': {
    tier: 'AI_GENERATION',
    maxBytes: 65536, // 64KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/send-pitch': {
    tier: 'AI_GENERATION',
    maxBytes: 65536, // 64KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },

  // Tier B: Payments
  'POST:/api/checkout': {
    tier: 'B',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/stripe/checkout': {
    tier: 'B',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/stripe/portal': {
    tier: 'B',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/plan': {
    tier: 'B',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'PUT:/api/plan': {
    tier: 'B',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'PATCH:/api/plan': {
    tier: 'B',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'DELETE:/api/plan': {
    tier: 'B',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },

  // Tier C: CRUD/actions
  'POST:/api/tags': {
    tier: 'WRITE',
    maxBytes: 16384, // 16KB
    rateLimit: {
      authPerMin: 60,
      ipPerMin: 30,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'DELETE:/api/tags': {
    tier: 'WRITE',
    maxBytes: 16384, // 16KB
    rateLimit: {
      authPerMin: 60,
      ipPerMin: 30,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/leads/[leadId]/tags': {
    tier: 'WRITE',
    maxBytes: 16384, // 16KB
    rateLimit: {
      authPerMin: 60,
      ipPerMin: 30,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'DELETE:/api/leads/[leadId]/tags': {
    tier: 'WRITE',
    maxBytes: 16384, // 16KB
    rateLimit: {
      authPerMin: 60,
      ipPerMin: 30,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/settings': {
    tier: 'WRITE',
    maxBytes: 16384, // 16KB
    rateLimit: {
      authPerMin: 60,
      ipPerMin: 30,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/settings/autopilot': {
    tier: 'WRITE',
    maxBytes: 4096, // 4KB
    rateLimit: {
      authPerMin: 60,
      ipPerMin: 30,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/push-to-crm': {
    tier: 'WRITE',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 60,
      ipPerMin: 30,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/tracker': {
    tier: 'WRITE',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 60,
      ipPerMin: 30,
    },
    originRequired: false, // Tracker may be called from external sites
    authRequired: false,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/verify-email': {
    tier: 'WRITE',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 60,
      ipPerMin: 30,
    },
    originRequired: true,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },

  // Tier D: Read/light
  'GET:/api/whoami': {
    tier: 'D',
    maxBytes: 8192, // 8KB
    rateLimit: {
      authPerMin: 120,
      ipPerMin: 60,
    },
    originRequired: false,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'GET:/api/plan': {
    tier: 'D',
    maxBytes: 8192, // 8KB
    rateLimit: {
      authPerMin: 120,
      ipPerMin: 60,
    },
    originRequired: false,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'GET:/api/history': {
    tier: 'D',
    maxBytes: 8192, // 8KB
    rateLimit: {
      authPerMin: 120,
      ipPerMin: 60,
    },
    originRequired: false,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'GET:/api/tags': {
    tier: 'D',
    maxBytes: 8192, // 8KB
    rateLimit: {
      authPerMin: 120,
      ipPerMin: 60,
    },
    originRequired: false,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'GET:/api/tracker': {
    tier: 'D',
    maxBytes: 8192, // 8KB
    rateLimit: {
      authPerMin: 120,
      ipPerMin: 60,
    },
    originRequired: false,
    authRequired: false,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'GET:/api/health': {
    tier: 'HEALTH',
    maxBytes: 1024, // GET; body ignored
    rateLimit: {
      authPerMin: 60,
      ipPerMin: 30,
    },
    originRequired: false,
    authRequired: false,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },

  // Tier E: Export
  'GET:/api/history/export': {
    tier: 'E',
    maxBytes: 16384, // 16KB
    rateLimit: {
      authPerMin: 2,
      ipPerMin: 2,
    },
    originRequired: false,
    authRequired: true,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
  },

  // Tier W: Webhooks (IP backstop only, NO auth required)
  'POST:/api/stripe/webhook': {
    tier: 'WEBHOOK',
    maxBytes: 262144, // 256KB
    rateLimit: {
      authPerMin: 300, // Not used (webhooks use IP only)
      ipPerMin: 300, // IP backstop
    },
    originRequired: false, // Webhooks don't have origin
    authRequired: false, // Webhooks don't use user auth
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: true,
  },
  'POST:/api/webhook': {
    tier: 'WEBHOOK',
    maxBytes: 262144, // 256KB
    rateLimit: {
      authPerMin: 300, // Not used (webhooks use IP only)
      ipPerMin: 300, // IP backstop
    },
    originRequired: false,
    authRequired: false, // Webhooks don't use user auth
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false, // Generic webhook may not have signature
  },
  'POST:/api/resend/webhook': {
    tier: 'WEBHOOK',
    maxBytes: 262144, // 256KB
    rateLimit: {
      authPerMin: 300,
      ipPerMin: 300,
    },
    originRequired: false,
    authRequired: false,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: true,
  },

  // Tier CRON: Scheduler routes (cron secret bypasses auth)
  'POST:/api/autopilot/run': {
    tier: 'CRON',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 5,
      ipPerMin: 5,
    },
    originRequired: false,
    authRequired: true,
    cronAllowed: true,
    devOnly: false,
    webhookSignatureRequired: false,
  },
  'POST:/api/leads/discover': {
    tier: 'CRON',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 5,
      ipPerMin: 5,
    },
    originRequired: false,
    authRequired: true,
    cronAllowed: true,
    devOnly: false,
    webhookSignatureRequired: false,
  },

  // Tier DEV: Dev-only routes (blocked in production, require x-dev-key header)
  'POST:/api/dev/create-user': {
    tier: 'DEV',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: false,
    authRequired: false, // Dev routes may not require auth (depends on implementation)
    cronAllowed: false,
    devOnly: true,
    webhookSignatureRequired: false,
  },
  'POST:/api/digest/test': {
    tier: 'DEV',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: false,
    authRequired: false, // Dev routes may not require auth
    cronAllowed: false,
    devOnly: true,
    webhookSignatureRequired: false,
  },
  'GET:/api/test-error': {
    tier: 'DEV',
    maxBytes: 8192, // 8KB
    rateLimit: {
      authPerMin: 120,
      ipPerMin: 60,
    },
    originRequired: false,
    authRequired: false, // Dev routes may not require auth
    cronAllowed: false,
    devOnly: true,
    webhookSignatureRequired: false,
  },
  'POST:/api/digest/run': {
    tier: 'CRON',
    maxBytes: 32768, // 32KB
    rateLimit: {
      authPerMin: 10,
      ipPerMin: 5,
    },
    originRequired: false, // Cron jobs don't have origin
    authRequired: true,
    cronAllowed: true,
    devOnly: false,
    webhookSignatureRequired: false,
  },
}

/**
 * Get security policy for a route
 * 
 * @param pathname - Route pathname (e.g., '/api/generate-pitch')
 * @param method - HTTP method (e.g., 'POST', 'GET')
 * @returns Route policy or default policy for unknown routes
 */
export function getRoutePolicy(pathname: string, method: string): RoutePolicy {
  // Normalize pathname (remove trailing slash, handle dynamic segments)
  const normalizedPath = normalizePathname(pathname)
  const key = `${method.toUpperCase()}:${normalizedPath}`
  
  const policy = ROUTE_POLICIES[key]
  if (policy) {
    return policy
  }

  // Return default policy for unknown routes
  return DEFAULT_POLICY
}

/**
 * Normalize pathname for policy lookup
 * Handles dynamic segments like [leadId] by converting to pattern
 */
function normalizePathname(pathname: string): string {
  // Remove trailing slash
  let normalized = pathname.replace(/\/$/, '')
  
  // Convert dynamic segments to pattern
  // e.g., /api/leads/abc123/tags -> /api/leads/[leadId]/tags
  // Match UUID pattern in path segments (e.g., /api/leads/123e4567-e89b-12d3-a456-426614174000/tags)
  const uuidPattern = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
  normalized = normalized.replace(uuidPattern, '/[leadId]')
  
  return normalized
}

/**
 * Get all defined route policies (for testing)
 */
export function getAllRoutePolicies(): Record<string, RoutePolicy> {
  return ROUTE_POLICIES
}
