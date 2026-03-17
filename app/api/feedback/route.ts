import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createCookieBridge, ok, fail, ErrorCode, HttpStatus } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'

const FeedbackSchema = z.object({
  route: z.string().min(1).max(512),
  surface: z.string().min(1).max(64),
  sentiment: z.enum(['up', 'down', 'note']),
  message: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  deviceClass: z.enum(['mobile', 'desktop', 'unknown']).optional().default('unknown'),
  viewport: z
    .object({
      w: z.number().int().min(0).max(10000).optional(),
      h: z.number().int().min(0).max(10000).optional(),
    })
    .optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    const rid = requestId

    if (body === undefined) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Invalid feedback payload', undefined, { status: 400 }, bridge, rid)
    }

    try {
      const supabase = createRouteClient(request, bridge)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const payload = body as z.infer<typeof FeedbackSchema>
      const insert = {
        user_id: user?.id ?? null,
        route: payload.route,
        surface: payload.surface,
        sentiment: payload.sentiment,
        message: payload.message ?? null,
        device_class: payload.deviceClass,
        viewport_w: payload.viewport?.w ?? null,
        viewport_h: payload.viewport?.h ?? null,
        meta: {},
      }

      const { error } = await supabase.from('feedback').insert(insert)
      if (error) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to save feedback', undefined, { status: 500 }, bridge, rid)
      }

      return ok({ saved: true }, { status: HttpStatus.CREATED }, bridge, rid)
    } catch (e) {
      return fail(
        ErrorCode.INTERNAL_ERROR,
        'Failed to save feedback',
        e instanceof Error ? { message: e.message } : undefined,
        { status: 500 },
        bridge,
        rid
      )
    }
  },
  {
    bodySchema: FeedbackSchema,
  }
)

