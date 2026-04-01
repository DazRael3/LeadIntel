'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type EmailTemplateId = string

type QaIssue = { code: string; message: string }
type QaResult = { templateId: EmailTemplateId; severity: 'ok' | 'warn' | 'error'; issues: QaIssue[] }

type PreviewEnvelope =
  | {
      ok: true
      data: {
        meta: { id: EmailTemplateId; label: string; kind: string; audience: string; purpose: string; trigger: string; lastUpdated: string }
        rendered: { subject: string; html: string; text: string }
        qa: { severity: 'ok' | 'warn' | 'error'; issues: QaIssue[] }
      }
    }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

type SendEnvelope =
  | { ok: true; data: { sent: boolean; status: string; reason?: string; qa?: { issues: QaIssue[] } } }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

export function AdminEmailLabClient(props: {
  appUrl: string
  templates: Array<{ id: EmailTemplateId; label: string; kind: string; audience: string }>
  qa: QaResult[]
}) {
  const { toast } = useToast()
  const [templateId, setTemplateId] = useState<EmailTemplateId>(props.templates[0]?.id ?? '')
  const [toEmail, setToEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewEnvelope | null>(null)

  const qaForSelected = useMemo(() => props.qa.find((q) => q.templateId === templateId) ?? null, [props.qa, templateId])

  async function loadPreview() {
    if (!templateId) return
    setLoading(true)
    try {
      track('email_lab_previewed', { templateId })
      const res = await fetch('/api/admin/email/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateId, appUrl: props.appUrl }),
      })
      const json = (await res.json().catch(() => null)) as PreviewEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({
          variant: 'destructive',
          title: 'Preview failed',
          description: json && 'error' in json ? json.error.message : 'Please try again.',
        })
        setPreview(json)
        return
      }
      setPreview(json)
    } finally {
      setLoading(false)
    }
  }

  async function testSend(dryRun: boolean) {
    if (!templateId) return
    setLoading(true)
    try {
      track('email_lab_test_send_clicked', { templateId, dryRun })
      const res = await fetch('/api/admin/email/test-send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateId, appUrl: props.appUrl, toEmail: toEmail.trim() || undefined, dryRun }),
      })
      const json = (await res.json().catch(() => null)) as SendEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        track('email_lab_test_send_result', { templateId, dryRun, ok: false })
        toast({
          variant: 'destructive',
          title: dryRun ? 'Dry run failed' : 'Test send failed',
          description: json && 'error' in json ? json.error.message : 'Please try again.',
        })
        return
      }
      track('email_lab_test_send_result', { templateId, dryRun, ok: true, status: json.data.status, sent: json.data.sent, reason: json.data.reason ?? null })
      toast({
        title: dryRun ? 'Dry run complete' : json.data.sent ? 'Test email sent' : 'Test email skipped',
        description: json.data.reason ? `Reason: ${json.data.reason}` : `Status: ${json.data.status}`,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Preview + test-send</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <Label>Template</Label>
            <select
              className="h-10 w-full rounded border border-cyan-500/20 bg-background/30 px-2 text-sm text-foreground"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={loading}
            >
              {props.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.kind})
                </option>
              ))}
            </select>
            {qaForSelected ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={qaForSelected.severity === 'error' ? 'destructive' : qaForSelected.severity === 'warn' ? 'secondary' : 'outline'}>
                  QA {qaForSelected.severity}
                </Badge>
                {qaForSelected.issues.length > 0 ? (
                  <div className="text-muted-foreground">{qaForSelected.issues.map((i) => i.code).join(', ')}</div>
                ) : (
                  <div className="text-muted-foreground">No issues</div>
                )}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Test-send recipient (optional)</Label>
            <Input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="leadintel@dazrael.com" disabled={loading} />
            <div className="text-xs text-muted-foreground">
              If left blank, the server uses the operator allowlist default. Test-sends are restricted to operator allowlist and deduped per day.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadPreview()} disabled={loading || !templateId}>
              Load preview
            </Button>
            <Button variant="outline" onClick={() => void testSend(true)} disabled={loading || !templateId}>
              Dry run
            </Button>
            <Button className="neon-border hover:glow-effect" onClick={() => void testSend(false)} disabled={loading || !templateId}>
              Send test
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Rendered output</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {!preview || preview.ok !== true ? (
            <div className="text-sm text-muted-foreground">Load a preview to see HTML + text rendering and QA issues.</div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">Subject</div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-2 text-sm text-foreground">
                {preview.data.rendered.subject}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Plain text</div>
                  <Textarea value={preview.data.rendered.text} readOnly className="min-h-[220px] text-xs" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">HTML (preview)</div>
                  <div
                    className="rounded border border-cyan-500/10 bg-white p-3 text-[13px] text-slate-900"
                    // Internal-only tool: we render our own generated HTML. No user input included here.
                    dangerouslySetInnerHTML={{ __html: preview.data.rendered.html }}
                  />
                </div>
              </div>

              <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-foreground">QA issues</div>
                  <Badge variant={preview.data.qa.severity === 'error' ? 'destructive' : preview.data.qa.severity === 'warn' ? 'secondary' : 'outline'}>
                    {preview.data.qa.severity}
                  </Badge>
                </div>
                {preview.data.qa.issues.length === 0 ? (
                  <div className="mt-2 text-xs text-muted-foreground">No issues detected.</div>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {preview.data.qa.issues.map((i) => (
                      <li key={i.code}>
                        <span className="font-medium text-foreground">{i.code}</span>: {i.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

