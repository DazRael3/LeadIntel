/**
 * Shared Zod Schemas for API Request Validation
 * 
 * Reusable schemas for common request patterns across API routes.
 * Import and extend these schemas for route-specific validation.
 */

import { z } from 'zod'

/**
 * Common query parameter schemas
 */
export const PaginationSchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  cursor: z.string().optional(),
})

export const SearchSchema = z.object({
  q: z.string().optional(),
  search: z.string().optional(),
})

export const TagFilterSchema = z.object({
  tag: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
})

/**
 * Common body schemas
 */

/**
 * Topic schema for AI pitch generation
 * Accepts either a URL (e.g., "lego.com") or a free-form topic (e.g., "cold outreach for HR leaders")
 * Renamed from CompanyUrlSchema but kept the field name for backwards compatibility
 */
export const CompanyUrlSchema = z.object({
  companyUrl: z
    .string()
    .trim()
    .min(1, 'Please enter a company name, URL, or topic for your pitch')
    .max(1000, 'Input is too long (max 1000 characters)'),
})

export const LeadIdSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format'),
})

export const TagNameSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(100, 'Tag name too long'),
})

/**
 * Settings schemas
 */
export const UserSettingsSchema = z.object({
  display_name: z.string().min(1, 'Display name is required').max(200),
  from_email: z.string().email('Invalid email address'),
  from_name: z.string().max(200).optional(),
  digest_enabled: z.boolean().optional().default(false),
  digest_dow: z.number().int().min(0).max(6).optional().default(1),
  digest_hour: z.number().int().min(0).max(23).optional().default(9),
  digest_webhook_url: z.string().url('Invalid webhook URL').optional().or(z.literal('')),
  autopilot_enabled: z.boolean().optional(),
})

/**
 * Email verification schema
 */
export const VerifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
})

/**
 * CRM push schema
 */
export const PushToCrmSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format'),
  crmType: z.enum(['zapier', 'webhook']).optional(),
})

/**
 * Send pitch schema
 */
export const SendPitchSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format'),
  recipientEmail: z.string().email('Invalid recipient email'),
  subject: z.string().min(1, 'Subject is required').max(200),
  message: z.string().optional(),
})

/**
 * Unlock lead schema
 */
export const UnlockLeadSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format'),
})

/**
 * Generate pitch options schema
 * Accepts either a URL or a free-form topic
 */
export const GeneratePitchOptionsSchema = z.object({
  companyUrl: z
    .string()
    .trim()
    .min(1, 'Please enter a company name, URL, or topic for your pitch')
    .max(1000, 'Input is too long (max 1000 characters)'),
  options: z.object({
    tone: z.enum(['professional', 'casual', 'friendly']).optional(),
    length: z.enum(['short', 'medium', 'long']).optional(),
    includeCallToAction: z.boolean().optional(),
  }).optional(),
})

/**
 * History query schema
 */
export const HistoryQuerySchema = PaginationSchema.merge(SearchSchema).merge(TagFilterSchema)

/**
 * Digest run schema (admin)
 */
export const DigestRunSchema = z.object({
  secret: z.string().min(1, 'Secret is required'),
  userId: z.string().uuid('Invalid user ID').optional(),
})

/**
 * Digest test schema
 */
export const DigestTestSchema = z.object({
  userId: z.string().uuid('Invalid user ID').optional(),
})

/**
 * Tracker schema (website visitor tracking)
 */
export const TrackerSchema = z.object({
  url: z.string().url('Invalid URL'),
  referrer: z.string().optional(),
  userAgent: z.string().optional(),
})

/**
 * Reveal schema (Clearbit reveal)
 */
export const RevealSchema = z.object({
  email: z.string().email('Invalid email address'),
})

/**
 * Generate sequence schema
 */
export const GenerateSequenceSchema = z.object({
  companyUrl: z.string().url().min(1, 'Company URL is required'),
  sequenceType: z.enum(['cold-email', 'follow-up', 'nurture']).optional(),
})

/**
 * Generate battle card schema
 */
export const GenerateBattleCardSchema = z.object({
  companyUrl: z.string().url().min(1, 'Company URL is required'),
})

/**
 * Generate LinkedIn comment schema
 */
export const GenerateLinkedInCommentSchema = z.object({
  companyUrl: z.string().url().min(1, 'Company URL is required'),
  postUrl: z.string().url().optional(),
})

/**
 * Send pitch extended schema (with optional fields)
 */
export const SendPitchExtendedSchema = SendPitchSchema.extend({
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
})

/**
 * History query with limit schema
 */
export const HistoryQueryWithLimitSchema = HistoryQuerySchema.extend({
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 100)),
})

/**
 * Lead tag POST schema
 */
export const LeadTagPostSchema = z.object({
  tagId: z.string().uuid('Invalid tag ID format'),
})

/**
 * Lead tag DELETE query schema
 */
export const LeadTagDeleteQuerySchema = z.object({
  tagId: z.string().uuid('Invalid tag ID format'),
})

/**
 * Tag ID query schema
 */
export const TagIdQuerySchema = z.object({
  id: z.string().uuid('Invalid tag ID format'),
})

/**
 * Create user schema (dev only)
 */
export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

/**
 * Reveal POST schema
 */
export const RevealPostSchema = RevealSchema

/**
 * Tracker POST schema
 */
export const TrackerPostSchema = TrackerSchema
