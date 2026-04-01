import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireAdminSessionOrNotFound } from '@/lib/admin/session'
import { getAppUrl } from '@/lib/app-url'
import { EMAIL_TEMPLATES, type EmailTemplateId } from '@/lib/email/registry'
import { qaAllEmailTemplates } from '@/lib/email/qa'
import { AdminEmailLabClient } from './AdminEmailLabClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Email Lab | LeadIntel',
  description: 'Preview and test-send automation email templates (internal only).',
  robots: { index: false, follow: false },
}

export default async function AdminEmailLabPage() {
  await requireAdminSessionOrNotFound()

  const appUrl = getAppUrl()
  const qa = qaAllEmailTemplates({ appUrl })

  const templates = EMAIL_TEMPLATES.map((t) => ({
    id: t.meta.id,
    label: t.meta.label,
    kind: t.meta.kind,
    audience: t.meta.audience,
  }))

  const counts = {
    ok: qa.filter((r) => r.severity === 'ok').length,
    warn: qa.filter((r) => r.severity === 'warn').length,
    error: qa.filter((r) => r.severity === 'error').length,
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-foreground">Email Lab</div>
          <div className="text-sm text-muted-foreground">Preview + QA + test-send for automation emails (operator-only).</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/ops">Back to Ops</Link>
          </Button>
        </div>
      </div>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Template health</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">OK: {counts.ok}</Badge>
          <Badge variant="outline">Warnings: {counts.warn}</Badge>
          <Badge variant={counts.error > 0 ? 'destructive' : 'outline'}>Errors: {counts.error}</Badge>
          <div className="text-xs text-muted-foreground">
            Test-send is restricted to operator allowlist (env) and deduped per template + recipient + day.
          </div>
        </CardContent>
      </Card>

      <AdminEmailLabClient
        appUrl={appUrl}
        templates={templates as Array<{ id: EmailTemplateId; label: string; kind: string; audience: string }>}
        qa={qa}
      />
    </div>
  )
}

