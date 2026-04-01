import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, createCookieBridge, asHttpError } from '@/lib/api/http'
import { hasAdminAccess } from '@/lib/admin/access'
import { getAppUrl } from '@/lib/app-url'
import { getEmailTemplate, type EmailTemplateId } from '@/lib/email/registry'
import { qaEmailTemplate } from '@/lib/email/qa'
import { methodNotAllowed } from '@/lib/api/method'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  templateId: z.string().trim().min(1).max(64),
  appUrl: z.string().trim().url().optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      if (!hasAdminAccess(request)) {
        return fail(ErrorCode.UNAUTHORIZED, 'Unauthorized', undefined, { status: 401 }, bridge, requestId)
      }

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Invalid payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)
      }

      const templateId = parsed.data.templateId as EmailTemplateId
      const entry = getEmailTemplate(templateId)
      if (!entry) {
        return fail(ErrorCode.NOT_FOUND, 'Template not found', { templateId }, { status: 404 }, bridge, requestId)
      }

      const appUrl = parsed.data.appUrl ?? getAppUrl()
      const rendered = entry.render({ appUrl })
      const issues = qaEmailTemplate({ templateId: entry.meta.id, rendered })

      void logProductEvent({
        userId: null,
        eventName: 'email_lab_previewed',
        eventProps: { templateId: entry.meta.id, qaIssueCount: issues.length },
      })

      return ok(
        {
          meta: entry.meta,
          rendered: {
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            templateName: rendered.templateName,
            kind: rendered.kind,
          },
          qa: { issues, severity: issues.length === 0 ? 'ok' : issues.some((i) => i.code.startsWith('missing_')) ? 'error' : 'warn' },
        },
        undefined,
        bridge,
        requestId
      )
    } catch (e) {
      return asHttpError(e, '/api/admin/email/preview', undefined, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

export function GET(request: NextRequest) {
  return methodNotAllowed(request, ['POST'])
}

export function PUT(request: NextRequest) {
  return methodNotAllowed(request, ['POST'])
}

export function PATCH(request: NextRequest) {
  return methodNotAllowed(request, ['POST'])
}

export function DELETE(request: NextRequest) {
  return methodNotAllowed(request, ['POST'])
}

