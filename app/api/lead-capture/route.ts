import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createCookieBridge, ok, fail, ErrorCode, HttpStatus } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { adminNotificationsEnabled, getLifecycleAdminEmails } from '@/lib/lifecycle/config'
import { renderAdminNotificationEmail, renderLeadCaptureConfirmationEmail } from '@/lib/email/internal'
import { sendEmailDeduped } from '@/lib/email/send-deduped'
import { sendEmailWithResend } from '@/lib/email/resend'
import { getResendReplyToEmail } from '@/lib/email/routing'
import { getAppUrl } from '@/lib/app-url'
import { isSchemaError } from '@/lib/supabase/schema'
import crypto from 'crypto'

const LeadCaptureSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().max(128).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  company: z.string().trim().max(128).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  role: z.string().trim().max(128).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  intent: z.enum(['demo', 'pricing_question', 'trial_help', 'general']).default('demo'),
  formType: z.enum(['demo', 'pricing_question', 'trial_help', 'general']).optional(),
  message: z.string().trim().max(1000).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  route: z.string().trim().min(1).max(512),
  sourcePage: z.string().trim().min(1).max(512).optional(),
  consentMarketing: z.boolean().optional().default(false),
  referrer: z.string().trim().max(512).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  utm: z
    .object({
      source: z.string().trim().max(128).optional(),
      medium: z.string().trim().max(128).optional(),
      campaign: z.string().trim().max(128).optional(),
    })
    .optional(),
  deviceClass: z.enum(['mobile', 'desktop', 'unknown']).optional().default('unknown'),
  viewport: z
    .object({
      w: z.number().int().min(0).max(10000).optional(),
      h: z.number().int().min(0).max(10000).optional(),
    })
    .optional(),
})

function dayKeyUtc(ts = Date.now()): string {
  const d = new Date(ts)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function computeDedupeKey(args: { email: string; formType: string; sourcePage: string }): string {
  // Daily dedupe per (email,formType,sourcePage) to keep this endpoint abuse-resistant.
  // This is an opaque hash; no secrets.
  const normalized = `${args.email.trim().toLowerCase()}|${args.formType}|${args.sourcePage.trim()}|${dayKeyUtc()}`
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

function getTrimmedEnv(name: string): string {
  const raw = process.env[name]
  return typeof raw === 'string' ? raw.trim() : ''
}

type LeadCaptureLogCategory =
  | 'validation'
  | 'supabase_insert'
  | 'schema_not_ready'
  | 'duplicate_merge'
  | 'followup_email'
  | 'admin_notify'
  | 'auth_lookup'
  | 'unexpected'

type DbLikeError = {
  code?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

type DuplicateMergeStatus = 'merged' | 'unchanged' | 'failed'
type InsertClient = 'admin' | 'route'
type InsertFailureReason =
  | 'lead_capture_schema_not_ready'
  | 'lead_capture_permission_denied'
  | 'lead_capture_client_misconfigured'
  | 'lead_capture_insert_failed'

const CONSENT_COMPATIBILITY_COLUMNS = ['consent_marketing', 'consent_timestamp'] as const
const CONSENT_COMPATIBILITY_COLUMN_SET = new Set<string>(CONSENT_COMPATIBILITY_COLUMNS)

type LeadCaptureStage =
  | 'validation'
  | 'auth_lookup'
  | 'insert_prepare'
  | 'admin_insert'
  | 'route_insert'
  | 'duplicate_merge'
  | 'followup_email'
  | 'admin_notify'
  | 'response'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeDbError(error: unknown): DbLikeError | null {
  const record = asRecord(error)
  if (!record) return null
  return {
    code: record.code,
    message: record.message,
    details: record.details,
    hint: record.hint,
  }
}

function getErrorCode(error: DbLikeError | null | undefined): string {
  const code = asString(error?.code).trim()
  return code.length > 0 ? code : 'unknown'
}

function getErrorMessage(error: DbLikeError | null | undefined): string {
  return asString(error?.message).toLowerCase()
}

function sanitizeLogText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  return normalized.slice(0, 240)
}

function sanitizeDbError(error: DbLikeError | null | undefined, client: InsertClient | null): Record<string, unknown> {
  return {
    code: getErrorCode(error),
    message: sanitizeLogText(error?.message),
    details: sanitizeLogText(error?.details),
    hint: sanitizeLogText(error?.hint),
    schema: 'api',
    table: 'lead_captures',
    client,
  }
}

function getUnexpectedErrorMeta(error: unknown): {
  errorType: string
  errorMessage: string | null
  stackLine: string | null
} {
  if (error instanceof Error) {
    const stackLines = error.stack
      ?.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    return {
      errorType: error.name || 'Error',
      errorMessage: sanitizeLogText(error.message),
      stackLine: sanitizeLogText((stackLines && stackLines.length > 1 ? stackLines[1] : null) ?? null),
    }
  }

  const errorRecord = asRecord(error)
  return {
    errorType: typeof error,
    errorMessage: sanitizeLogText(errorRecord?.message),
    stackLine: null,
  }
}

function isUniqueViolation(error: DbLikeError | null | undefined): boolean {
  const code = getErrorCode(error)
  const message = getErrorMessage(error)
  return code === '23505' || message.includes('duplicate') || message.includes('unique')
}

function isSchemaOrTableMissing(error: DbLikeError | null | undefined): boolean {
  if (!error) return false
  const code = getErrorCode(error)
  const message = getErrorMessage(error)
  if (isSchemaError(error)) return true
  return (
    code === '42P01' || // undefined_table
    code === '42703' || // undefined_column
    code.toLowerCase().includes('pgrst204') ||
    (message.includes('relation') && message.includes('does not exist')) ||
    (message.includes('column') && message.includes('does not exist'))
  )
}

function isPermissionDenied(error: DbLikeError | null | undefined): boolean {
  if (!error) return false
  const code = getErrorCode(error)
  const message = getErrorMessage(error)
  return (
    code === '42501' ||
    message.includes('permission denied') ||
    message.includes('row-level security') ||
    message.includes('insufficient privilege')
  )
}

function isClientMisconfigured(error: DbLikeError | null | undefined): boolean {
  if (!error) return false
  const code = getErrorCode(error)
  const message = getErrorMessage(error)
  return (
    code === 'ROUTE_CLIENT_UNAVAILABLE' ||
    code === 'ADMIN_CLIENT_UNAVAILABLE' ||
    code === 'INSERT_CLIENT_MISCONFIGURED' ||
    code === 'INSERT_RESULT_INVALID' ||
    code === 'INSERT_OPERATION_THROWN' ||
    message.includes('missing supabase environment variables') ||
    message.includes('service role is not configured') ||
    message.includes('client unavailable')
  )
}

function getRouteSupabaseKey(): string {
  return getTrimmedEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || getTrimmedEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

type InsertEnvStatus = {
  hasSupabaseUrl: boolean
  hasServiceRole: boolean
  hasRouteKey: boolean
  adminInsertReady: boolean
  routeInsertReady: boolean
}

function getInsertEnvStatus(): InsertEnvStatus {
  const hasSupabaseUrl = Boolean(getTrimmedEnv('NEXT_PUBLIC_SUPABASE_URL'))
  const hasServiceRole = Boolean(getTrimmedEnv('SUPABASE_SERVICE_ROLE_KEY'))
  const hasRouteKey = Boolean(getRouteSupabaseKey())
  return {
    hasSupabaseUrl,
    hasServiceRole,
    hasRouteKey,
    adminInsertReady: hasSupabaseUrl && hasServiceRole,
    routeInsertReady: hasSupabaseUrl && hasRouteKey,
  }
}

function classifyInsertFailure(error: DbLikeError | null | undefined): InsertFailureReason {
  if (isSchemaOrTableMissing(error)) return 'lead_capture_schema_not_ready'
  if (isPermissionDenied(error)) return 'lead_capture_permission_denied'
  if (isClientMisconfigured(error)) return 'lead_capture_client_misconfigured'
  return 'lead_capture_insert_failed'
}

function getSchemaMissingColumn(error: DbLikeError | null | undefined): string | null {
  const message = asString(error?.message)
  if (!message) return null
  const singleQuote = message.match(/'([a-zA-Z0-9_]+)' column/i)
  if (singleQuote && singleQuote[1]) return singleQuote[1]
  const doubleQuote = message.match(/column \"([a-zA-Z0-9_]+)\"/i)
  if (doubleQuote && doubleQuote[1]) return doubleQuote[1]
  return null
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function logLeadCapture(
  level: 'info' | 'warn' | 'error',
  args: {
    category: LeadCaptureLogCategory
    requestId: string
    meta?: Record<string, unknown>
  }
): void {
  const payload = {
    route: '/api/lead-capture',
    requestId: args.requestId,
    category: args.category,
    ...(args.meta ?? {}),
  }
  if (level === 'error') {
    console.error('[lead-capture] route event', payload)
    return
  }
  if (level === 'warn') {
    console.warn('[lead-capture] route event', payload)
    return
  }
  console.log('[lead-capture] route event', payload)
}

function invokeMethod(
  owner: Record<string, unknown>,
  method: unknown,
  args: unknown[]
): { ok: true; value: unknown } | { ok: false; error: DbLikeError } {
  if (typeof method !== 'function') {
    return { ok: false, error: { code: 'INSERT_CLIENT_MISCONFIGURED', message: 'method is not callable' } }
  }
  try {
    return { ok: true, value: Reflect.apply(method, owner, args) }
  } catch (error) {
    const meta = getUnexpectedErrorMeta(error)
    return {
      ok: false,
      error: {
        code: 'INSERT_OPERATION_THROWN',
        message: meta.errorMessage ?? 'method call threw',
      },
    }
  }
}

async function insertLeadCaptureWithSchema(
  client: unknown,
  row: unknown
): Promise<{ error: DbLikeError | null }> {
  try {
    const clientRecord = asRecord(client)
    if (!clientRecord) {
      return { error: { code: 'INSERT_CLIENT_MISCONFIGURED', message: 'insert client is not an object' } }
    }

    const schemaFactory = clientRecord.schema
    const readInsertResult = (value: unknown): { error: DbLikeError | null } => {
      const resultRecord = asRecord(value)
      if (!resultRecord) {
        return { error: { code: 'INSERT_RESULT_INVALID', message: 'insert result missing' } }
      }
      if (!('error' in resultRecord)) {
        return { error: { code: 'INSERT_RESULT_INVALID', message: 'insert result missing error field' } }
      }
      const rawError = resultRecord.error
      if (rawError === null || rawError === undefined) return { error: null }
      return { error: normalizeDbError(rawError) ?? { code: 'INSERT_RESULT_INVALID', message: 'insert error shape invalid' } }
    }

    if (typeof schemaFactory === 'function') {
      const scoped = invokeMethod(clientRecord, schemaFactory, ['api'])
      if (!scoped.ok) return { error: scoped.error }
      const scopedClient = asRecord(scoped.value)
      const fromFn = scopedClient?.from
      if (!scopedClient || typeof fromFn !== 'function') {
        return { error: { code: 'INSERT_CLIENT_MISCONFIGURED', message: 'scoped client missing from()' } }
      }
      const tableCall = invokeMethod(scopedClient, fromFn, ['lead_captures'])
      if (!tableCall.ok) return { error: tableCall.error }
      const tableClient = asRecord(tableCall.value)
      const insertFn = tableClient?.insert
      if (!tableClient || typeof insertFn !== 'function') {
        return { error: { code: 'INSERT_CLIENT_MISCONFIGURED', message: 'table client missing insert()' } }
      }
      const insertCall = invokeMethod(tableClient, insertFn, [row])
      if (!insertCall.ok) return { error: insertCall.error }
      return readInsertResult(await insertCall.value)
    }

    const fromFn = clientRecord.from
    if (typeof fromFn !== 'function') {
      return { error: { code: 'INSERT_CLIENT_MISCONFIGURED', message: 'client missing from()' } }
    }
    const tableCall = invokeMethod(clientRecord, fromFn, ['lead_captures'])
    if (!tableCall.ok) return { error: tableCall.error }
    const tableClient = asRecord(tableCall.value)
    const insertFn = tableClient?.insert
    if (!tableClient || typeof insertFn !== 'function') {
      return { error: { code: 'INSERT_CLIENT_MISCONFIGURED', message: 'table client missing insert()' } }
    }
    const insertCall = invokeMethod(tableClient, insertFn, [row])
    if (!insertCall.ok) return { error: insertCall.error }
    return readInsertResult(await insertCall.value)
  } catch (error) {
    const meta = getUnexpectedErrorMeta(error)
    return {
      error: {
        code: 'INSERT_OPERATION_THROWN',
        message: meta.errorMessage ?? 'insert operation threw',
      },
    }
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function chooseBetterText(existing: string | null | undefined, incoming: string | null | undefined): string | null {
  const current = normalizeOptionalText(existing)
  const next = normalizeOptionalText(incoming)
  if (!current) return next
  if (!next) return current
  return next.length > current.length ? next : current
}

type DuplicateMergeInput = {
  dedupeKey: string
  userId: string | null
  consentTimestamp: string | null
  payload: z.infer<typeof LeadCaptureSchema>
  sourcePage: string
}

type ExistingLeadCaptureRow = {
  id: string
  user_id: string | null
  name: string | null
  company: string | null
  role: string | null
  message: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  route: string
  source_page: string
  consent_marketing: boolean
  consent_timestamp: string | null
  viewport_w: number | null
  viewport_h: number | null
  device_class: 'mobile' | 'desktop' | 'unknown'
}

async function mergeDuplicateLeadCapture(input: DuplicateMergeInput): Promise<DuplicateMergeStatus> {
  const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
  if (!hasServiceRole) return 'unchanged'

  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data: existingRaw, error: selectError } = await admin
      .from('lead_captures')
      .select(
        'id,user_id,name,company,role,message,referrer,utm_source,utm_medium,utm_campaign,route,source_page,consent_marketing,consent_timestamp,viewport_w,viewport_h,device_class'
      )
      .eq('dedupe_key', input.dedupeKey)
      .maybeSingle()
    if (selectError || !existingRaw) return 'failed'
    const existing = existingRaw as ExistingLeadCaptureRow

    const mergedName = chooseBetterText(existing.name, input.payload.name)
    const mergedCompany = chooseBetterText(existing.company, input.payload.company)
    const mergedRole = chooseBetterText(existing.role, input.payload.role)
    const mergedMessage = chooseBetterText(existing.message, input.payload.message)
    const mergedReferrer = chooseBetterText(existing.referrer, input.payload.referrer)
    const mergedUtmSource = chooseBetterText(existing.utm_source, input.payload.utm?.source)
    const mergedUtmMedium = chooseBetterText(existing.utm_medium, input.payload.utm?.medium)
    const mergedUtmCampaign = chooseBetterText(existing.utm_campaign, input.payload.utm?.campaign)
    const mergedConsentMarketing = Boolean(existing.consent_marketing || input.payload.consentMarketing)
    const mergedConsentTimestamp =
      existing.consent_timestamp ??
      (input.payload.consentMarketing && input.consentTimestamp ? input.consentTimestamp : null)
    const mergedUserId = existing.user_id ?? input.userId
    const mergedRoute = chooseBetterText(existing.route, input.payload.route) ?? input.payload.route
    const mergedSourcePage = chooseBetterText(existing.source_page, input.sourcePage) ?? input.sourcePage
    const mergedDeviceClass =
      existing.device_class === 'unknown' && input.payload.deviceClass !== 'unknown'
        ? input.payload.deviceClass
        : existing.device_class
    const mergedViewportW =
      typeof existing.viewport_w === 'number' ? existing.viewport_w : (input.payload.viewport?.w ?? null)
    const mergedViewportH =
      typeof existing.viewport_h === 'number' ? existing.viewport_h : (input.payload.viewport?.h ?? null)

    const updates: Record<string, string | number | boolean | null> = {}
    if (mergedUserId !== existing.user_id) updates.user_id = mergedUserId
    if (mergedName !== existing.name) updates.name = mergedName
    if (mergedCompany !== existing.company) updates.company = mergedCompany
    if (mergedRole !== existing.role) updates.role = mergedRole
    if (mergedMessage !== existing.message) updates.message = mergedMessage
    if (mergedReferrer !== existing.referrer) updates.referrer = mergedReferrer
    if (mergedUtmSource !== existing.utm_source) updates.utm_source = mergedUtmSource
    if (mergedUtmMedium !== existing.utm_medium) updates.utm_medium = mergedUtmMedium
    if (mergedUtmCampaign !== existing.utm_campaign) updates.utm_campaign = mergedUtmCampaign
    if (mergedRoute !== existing.route) updates.route = mergedRoute
    if (mergedSourcePage !== existing.source_page) updates.source_page = mergedSourcePage
    if (mergedConsentMarketing !== existing.consent_marketing) updates.consent_marketing = mergedConsentMarketing
    if (mergedConsentTimestamp !== existing.consent_timestamp) updates.consent_timestamp = mergedConsentTimestamp
    if (mergedDeviceClass !== existing.device_class) updates.device_class = mergedDeviceClass
    if (mergedViewportW !== existing.viewport_w) updates.viewport_w = mergedViewportW
    if (mergedViewportH !== existing.viewport_h) updates.viewport_h = mergedViewportH

    if (Object.keys(updates).length === 0) return 'unchanged'

    const { error: updateError } = await admin.from('lead_captures').update(updates).eq('id', existing.id)
    return updateError ? 'failed' : 'merged'
  } catch {
    // Merge is best-effort. Duplicate submissions should still return success.
    return 'failed'
  }
}

async function sendLeadCaptureFollowUp(args: {
  email: string
  dedupeKey: string
  recipientName?: string
  company?: string
  formType: 'demo' | 'pricing_question' | 'trial_help' | 'general'
  sourcePage: string
  consentMarketing: boolean
}): Promise<{ sent: boolean; reason?: string }> {
  const resendApiKey = getTrimmedEnv('RESEND_API_KEY')
  const from = getTrimmedEnv('RESEND_FROM_EMAIL')
  const hasResend = Boolean(resendApiKey) && Boolean(from)
  if (!hasResend) {
    return { sent: false, reason: 'email_not_configured' }
  }

  try {
    const appUrl = getAppUrl()
    const email = renderLeadCaptureConfirmationEmail({
      recipientName: args.recipientName,
      appUrl,
      formType: args.formType,
      sourcePage: args.sourcePage,
      consentMarketing: args.consentMarketing,
      company: args.company,
      variationSeed: args.dedupeKey,
    })
    const replyTo = getResendReplyToEmail()
    const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
    if (hasServiceRole) {
      const admin = createSupabaseAdminClient({ schema: 'api' })
      const send = await sendEmailDeduped(admin, {
        dedupeKey: `lead_capture_followup:${args.dedupeKey}`,
        userId: null,
        toEmail: args.email,
        fromEmail: from,
        replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
        kind: 'lifecycle',
        template: 'lead_capture_followup',
        tags: [
          { name: 'kind', value: 'lead_capture' },
          { name: 'flow', value: args.consentMarketing ? 'followup_opt_in' : 'followup_transactional' },
          { name: 'category', value: args.consentMarketing ? 'marketing' : 'transactional' },
        ],
        meta: {
          formType: args.formType,
          sourcePage: args.sourcePage,
          consentMarketing: args.consentMarketing,
          transactionalOnly: !args.consentMarketing,
        },
      })
      if (send && typeof send === 'object' && 'ok' in send && send.ok === true && 'status' in send && send.status === 'sent') {
        return { sent: true }
      }
      if (send && typeof send === 'object' && 'ok' in send && send.ok === true && 'status' in send && send.status === 'skipped') {
        const reason = 'reason' in send && typeof send.reason === 'string' ? send.reason : 'deduped'
        return { sent: false, reason }
      }
      return { sent: false, reason: 'send_failed' }
    }

    const direct = await sendEmailWithResend({
      from,
      to: args.email,
      replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [
        { name: 'kind', value: 'lead_capture' },
        { name: 'flow', value: args.consentMarketing ? 'followup_opt_in' : 'followup_transactional' },
        { name: 'category', value: args.consentMarketing ? 'marketing' : 'transactional' },
      ],
    })
    if (direct && typeof direct === 'object' && 'ok' in direct && direct.ok === true) {
      return { sent: true }
    }
    return { sent: false, reason: 'send_failed' }
  } catch {
    return { sent: false, reason: 'send_failed' }
  }
}

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    const rid = requestId
    let stage: LeadCaptureStage = 'validation'

    if (body === undefined) {
      logLeadCapture('warn', {
        category: 'validation',
        requestId: rid,
        meta: { bodyPresent: false },
      })
      return fail(ErrorCode.VALIDATION_ERROR, 'Invalid lead capture payload', undefined, { status: 400 }, bridge, rid)
    }

    try {
      logLeadCapture('info', {
        category: 'validation',
        requestId: rid,
        meta: { validationPassed: true },
      })
      let supabase: ReturnType<typeof createRouteClient> | null = null
      try {
        supabase = createRouteClient(request, bridge)
      } catch {
        logLeadCapture('warn', {
          category: 'supabase_insert',
          requestId: rid,
          meta: { insertAttempted: false, routeClientReady: false, subsystem: 'client_creation_failure' },
        })
      }
      let userId: string | null = null
      try {
        stage = 'auth_lookup'
        if (!supabase) {
          throw new Error('route client unavailable')
        }
        const authClient = asRecord(asRecord(supabase)?.auth)
        const getUser = authClient?.getUser
        if (!authClient || typeof getUser !== 'function') {
          throw new Error('auth client unavailable')
        }
        const authCall = invokeMethod(authClient, getUser, [])
        if (!authCall.ok) {
          throw new Error(asString(authCall.error.message) || 'auth getUser threw')
        }
        const authResult = await authCall.value
        const authRecord = asRecord(authResult)
        const authData = asRecord(authRecord?.data)
        const authUser = asRecord(authData?.user)
        const authError = normalizeDbError(authRecord?.error)
        if (authError) {
          logLeadCapture('warn', {
            category: 'auth_lookup',
            requestId: rid,
            meta: { authError: true, authCode: getErrorCode(authError) },
          })
        }
        userId = typeof authUser?.id === 'string' ? authUser.id : null
      } catch (authLookupError) {
        const authMeta = getUnexpectedErrorMeta(authLookupError)
        // Public lead capture should still save even if auth lookup fails.
        logLeadCapture('warn', {
          category: 'auth_lookup',
          requestId: rid,
          meta: {
            authError: true,
            authLookupThrew: true,
            authErrorType: authMeta.errorType,
            authErrorMessage: authMeta.errorMessage,
          },
        })
      }

      stage = 'insert_prepare'
      const payload = body as z.infer<typeof LeadCaptureSchema>
      const formType = payload.formType ?? payload.intent
      const sourcePage = payload.sourcePage ?? payload.route
      const dedupeKey = computeDedupeKey({ email: payload.email, formType, sourcePage })
      const consentTimestamp = payload.consentMarketing ? new Date().toISOString() : null
      const envStatus = getInsertEnvStatus()
      const hasServiceRole = envStatus.hasServiceRole
      let insertPayload: Record<string, unknown> = {
        user_id: userId,
        email: payload.email.trim(),
        name: payload.name ?? null,
        company: payload.company ?? null,
        role: payload.role ?? null,
        intent: payload.intent,
        form_type: formType,
        message: payload.message ?? null,
        route: payload.route,
        source_page: sourcePage,
        consent_marketing: payload.consentMarketing,
        consent_timestamp: consentTimestamp,
        referrer: payload.referrer ?? null,
        utm_source: payload.utm?.source ?? null,
        utm_medium: payload.utm?.medium ?? null,
        utm_campaign: payload.utm?.campaign ?? null,
        device_class: payload.deviceClass,
        viewport_w: payload.viewport?.w ?? null,
        viewport_h: payload.viewport?.h ?? null,
        dedupe_key: dedupeKey,
        status: 'new',
        meta: {},
      }

      logLeadCapture('info', {
        category: 'supabase_insert',
        requestId: rid,
        meta: {
          insertAttempted: true,
          routeClientReady: Boolean(supabase),
          hasServiceRole: envStatus.hasServiceRole,
          hasSupabaseUrl: envStatus.hasSupabaseUrl,
          hasRouteKey: envStatus.hasRouteKey,
          insertStrategy: envStatus.adminInsertReady ? 'admin_first' : 'route_only',
        },
      })

      let insertClient: InsertClient = 'route'
      let error: DbLikeError | null = null
      const retryWithSchemaCompatiblePayload = async (client: unknown, clientName: InsertClient): Promise<void> => {
        if (!error) return
        const code = getErrorCode(error).toLowerCase()
        if (!code.includes('pgrst204')) return
        const missingColumn = getSchemaMissingColumn(error)
        if (!missingColumn || !CONSENT_COMPATIBILITY_COLUMN_SET.has(missingColumn)) return
        const removedCompatibilityFields = CONSENT_COMPATIBILITY_COLUMNS.filter((column) => column in insertPayload)
        if (removedCompatibilityFields.length === 0) return
        const reduced = { ...insertPayload }
        removedCompatibilityFields.forEach((column) => {
          delete reduced[column]
        })
        logLeadCapture('warn', {
          category: 'schema_not_ready',
          requestId: rid,
          meta: {
            schemaCompatibilityRetry: true,
            schemaCompatibilityRetryMode: 'drop_known_optional_consent_fields',
            removedCompatibilityFields,
            triggerMissingColumn: missingColumn,
            insertClient: clientName,
          },
        })
        const retried = await insertLeadCaptureWithSchema(client, reduced)
        error = retried.error
        if (!error) {
          insertPayload = reduced
        }
      }

      let adminClientUnavailable = false
      let adminClient: unknown = null
      if (envStatus.adminInsertReady) {
        stage = 'admin_insert'
        insertClient = 'admin'
        try {
          adminClient = createSupabaseAdminClient({ schema: 'api' })
          const result = await insertLeadCaptureWithSchema(adminClient, insertPayload)
          error = result.error
          await retryWithSchemaCompatiblePayload(adminClient, 'admin')
        } catch (adminError) {
          adminClientUnavailable = true
          error = {
            code: 'ADMIN_CLIENT_UNAVAILABLE',
            message: adminError instanceof Error ? adminError.message : 'admin client unavailable',
          }
        }
      } else {
        adminClientUnavailable = true
        error = {
          code: 'ADMIN_CLIENT_UNAVAILABLE',
          message: envStatus.hasSupabaseUrl
            ? 'admin client unavailable'
            : 'missing supabase environment variables',
        }
      }

      const adminInsertMisconfigured = insertClient === 'admin' && Boolean(error) && isClientMisconfigured(error)
      const adminSchemaNotReady = insertClient === 'admin' && Boolean(error) && isSchemaOrTableMissing(error)
      if (adminClientUnavailable || adminInsertMisconfigured || adminSchemaNotReady) {
        stage = 'route_insert'
        insertClient = 'route'
        logLeadCapture('warn', {
          category: 'supabase_insert',
          requestId: rid,
          meta: {
            insertOk: false,
            insertClient: 'admin',
            subsystem: adminClientUnavailable
              ? 'admin_client_unavailable'
              : adminInsertMisconfigured
                ? 'admin_insert_misconfigured'
                : 'admin_schema_not_ready',
            dbError: sanitizeDbError(error, 'admin'),
          },
        })

        if (supabase) {
          const fallback = await insertLeadCaptureWithSchema(supabase, insertPayload)
          error = fallback.error
          await retryWithSchemaCompatiblePayload(supabase, 'route')
        } else {
          error = {
            code: envStatus.routeInsertReady ? 'ROUTE_CLIENT_UNAVAILABLE' : 'INSERT_CLIENT_MISCONFIGURED',
            message: envStatus.routeInsertReady ? 'route client unavailable' : 'route client misconfigured',
          }
        }
      }

      let wasDuplicate = false
      let duplicateMerged = false
      if (error) {
        if (isUniqueViolation(error)) {
          stage = 'duplicate_merge'
          wasDuplicate = true
          logLeadCapture('warn', {
            category: 'supabase_insert',
            requestId: rid,
            meta: {
              insertOk: false,
              duplicate: true,
              insertClient,
              reason: 'duplicate_submission',
              dbError: sanitizeDbError(error, insertClient),
            },
          })
          const duplicateMergeStatus = await mergeDuplicateLeadCapture({
            dedupeKey,
            userId,
            consentTimestamp,
            payload,
            sourcePage,
          })
          const normalizedMergeStatus: DuplicateMergeStatus =
            duplicateMergeStatus === 'merged' || duplicateMergeStatus === 'unchanged' || duplicateMergeStatus === 'failed'
              ? duplicateMergeStatus
              : 'failed'
          duplicateMerged = normalizedMergeStatus === 'merged'
          logLeadCapture(normalizedMergeStatus === 'failed' ? 'warn' : 'info', {
            category: 'duplicate_merge',
            requestId: rid,
            meta: { duplicate: true, merged: duplicateMerged, status: normalizedMergeStatus },
          })
        } else {
          const insertFailureReason = classifyInsertFailure(error)
          if (insertFailureReason === 'lead_capture_schema_not_ready') {
            logLeadCapture('warn', {
              category: 'schema_not_ready',
              requestId: rid,
              meta: {
                schemaReady: false,
                insertClient,
                reason: insertFailureReason,
                dbError: sanitizeDbError(error, insertClient),
              },
            })
            return fail(
              ErrorCode.INTERNAL_ERROR,
              'Lead capture schema is not ready. Apply latest migrations and retry.',
              { reason: insertFailureReason, insertClient, insertError: sanitizeDbError(error, insertClient) },
              { status: 503 },
              bridge,
              rid
            )
          }
          logLeadCapture('error', {
            category: 'supabase_insert',
            requestId: rid,
            meta: {
              insertOk: false,
              duplicate: false,
              insertClient,
              reason: insertFailureReason,
              dbError: sanitizeDbError(error, insertClient),
            },
          })
          return fail(
            ErrorCode.DATABASE_ERROR,
            'Failed to save request',
            { reason: insertFailureReason, insertClient, insertError: sanitizeDbError(error, insertClient) },
            { status: 500 },
            bridge,
            rid
          )
        }
      } else {
        try {
          const routeToLog = isValidUrl(payload.route) ? new URL(payload.route).pathname : payload.route
          logLeadCapture('info', {
            category: 'supabase_insert',
            requestId: rid,
            meta: { insertOk: true, duplicate: false, schema: 'api', table: 'lead_captures', insertClient, sourceRoute: routeToLog },
          })
        } catch {
          logLeadCapture('info', {
            category: 'supabase_insert',
            requestId: rid,
            meta: { insertOk: true, duplicate: false, schema: 'api', table: 'lead_captures', insertClient },
          })
        }
      }

      let followUpSent = false
      let followUpReason: string | undefined
      if (!wasDuplicate) {
        stage = 'followup_email'
        try {
          const followUp = await sendLeadCaptureFollowUp({
            email: payload.email.trim(),
            dedupeKey,
            recipientName: payload.name,
            company: payload.company,
            formType,
            sourcePage,
            consentMarketing: payload.consentMarketing,
          })
          const followUpRecord = asRecord(followUp)
          followUpSent = followUpRecord?.sent === true
          followUpReason = asString(followUpRecord?.reason) || (followUpSent ? undefined : 'send_failed')
        } catch (followUpError) {
          const followUpMeta = getUnexpectedErrorMeta(followUpError)
          followUpSent = false
          followUpReason = 'send_failed'
          logLeadCapture('warn', {
            category: 'followup_email',
            requestId: rid,
            meta: {
              attempted: true,
              sent: false,
              reason: 'send_failed',
              errorType: followUpMeta.errorType,
              errorMessage: followUpMeta.errorMessage,
            },
          })
        }
        logLeadCapture(followUpSent ? 'info' : 'warn', {
          category: 'followup_email',
          requestId: rid,
          meta: { attempted: true, sent: followUpSent, reason: followUpReason ?? null },
        })
      } else {
        logLeadCapture('info', {
          category: 'followup_email',
          requestId: rid,
          meta: { attempted: false, sent: false, reason: 'duplicate_submission' },
        })
      }

      let adminNotifyAttempted = false
      let adminNotifyFailed = false
      let adminRecipients = 0
      let adminDelivered = 0
      if (!wasDuplicate) {
        stage = 'admin_notify'
        // Optional: operator notification for net-new leads only (best-effort, deduped).
        // Duplicate submissions may still merge data, but should not fan out duplicate alerts.
        try {
          const from = getTrimmedEnv('RESEND_FROM_EMAIL')
          const hasResend = Boolean(getTrimmedEnv('RESEND_API_KEY')) && Boolean(from)
          const admins = getLifecycleAdminEmails()
          adminRecipients = admins.length
          if (hasServiceRole && adminNotificationsEnabled() && admins.length > 0 && hasResend) {
            adminNotifyAttempted = true
            const appUrl = getAppUrl()
            const email = renderAdminNotificationEmail({
              title: 'Lead capture',
              appUrl,
              ctaHref: `${appUrl}${payload.route}`,
              ctaLabel: 'Open route',
              lines: [
                `intent: ${payload.intent}`,
                payload.name ? `name: ${payload.name}` : '',
                `email: ${payload.email}`,
                payload.company ? `company: ${payload.company}` : '',
                payload.role ? `role: ${payload.role}` : '',
                `form_type: ${formType}`,
                `source_page: ${sourcePage}`,
                `consent_marketing: ${payload.consentMarketing ? 'yes' : 'no'}`,
                payload.referrer ? `referrer: ${payload.referrer}` : '',
                payload.utm?.source ? `utm_source: ${payload.utm.source}` : '',
                payload.utm?.medium ? `utm_medium: ${payload.utm.medium}` : '',
                payload.utm?.campaign ? `utm_campaign: ${payload.utm.campaign}` : '',
                payload.message ? `message: ${payload.message}` : '(no message)',
              ].filter((l) => l.length > 0),
            })
            const adminClient = createSupabaseAdminClient({ schema: 'api' })
            const results = await Promise.allSettled(
              admins.map((toEmail) =>
                sendEmailDeduped(adminClient, {
                  dedupeKey: `admin:lead_capture:${dedupeKey}:${toEmail}`,
                  userId: null,
                  toEmail,
                  fromEmail: from,
                  replyTo: getResendReplyToEmail(),
                  subject: email.subject,
                  html: email.html,
                  text: email.text,
                  kind: 'internal',
                  template: 'admin_lead_capture',
                  tags: [
                    { name: 'kind', value: 'internal' },
                    { name: 'type', value: 'lead_capture' },
                  ],
                  meta: { intent: payload.intent, route: payload.route },
                })
              )
            )
            adminDelivered = results.reduce((count, result) => {
              if (result.status !== 'fulfilled') return count
              const value = asRecord(result.value)
              return value?.ok === true && value.status === 'sent' ? count + 1 : count
            }, 0)
            adminNotifyFailed = results.some((result) => {
              if (result.status === 'rejected') return true
              const value = asRecord(result.value)
              return value?.ok !== true
            })
            logLeadCapture(adminNotifyFailed ? 'warn' : 'info', {
              category: 'admin_notify',
              requestId: rid,
              meta: {
                attempted: adminNotifyAttempted,
                recipients: adminRecipients,
                delivered: adminDelivered,
                failed: adminNotifyFailed,
              },
            })
          } else {
            logLeadCapture('info', {
              category: 'admin_notify',
              requestId: rid,
              meta: {
                attempted: false,
                recipients: adminRecipients,
                delivered: 0,
                skipped: true,
              },
            })
          }
        } catch {
          // best-effort only
          adminNotifyFailed = true
          logLeadCapture('warn', {
            category: 'admin_notify',
            requestId: rid,
            meta: {
              attempted: adminNotifyAttempted,
              recipients: adminRecipients,
              delivered: adminDelivered,
              failed: true,
            },
          })
        }
      } else {
        logLeadCapture('info', {
          category: 'admin_notify',
          requestId: rid,
          meta: { attempted: false, recipients: 0, delivered: 0, skipped: true, duplicate: true },
        })
      }

      stage = 'response'
      return ok(
        {
          saved: true,
          resultCode: wasDuplicate ? 'duplicate_submission' : 'saved',
          insertClient,
          deduped: wasDuplicate,
          mergedOnDuplicate: duplicateMerged,
          followUp: {
            sent: followUpSent,
            ...(followUpReason ? { reason: followUpReason } : {}),
          },
        },
        { status: HttpStatus.CREATED },
        bridge,
        rid
      )
    } catch (e) {
      const unexpected = getUnexpectedErrorMeta(e)
      logLeadCapture('error', {
        category: 'unexpected',
        requestId: rid,
        meta: {
          stage,
          errorType: unexpected.errorType,
          errorMessage: unexpected.errorMessage,
          stackLine: unexpected.stackLine,
        },
      })
      return fail(
        ErrorCode.INTERNAL_ERROR,
        'Failed to submit request',
        { reason: 'unexpected' },
        { status: 500 },
        bridge,
        rid
      )
    }
  },
  { bodySchema: LeadCaptureSchema }
)

