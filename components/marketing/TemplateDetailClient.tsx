'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import type { OutreachTemplate, TemplateTokenDef } from '@/lib/templates/registry'

function extractSubject(body: string): { subject: string | null; bodyWithoutSubject: string } {
  const lines = body.split('\n')
  const first = (lines[0] ?? '').trim()
  if (!/^subject:/i.test(first)) return { subject: null, bodyWithoutSubject: body }
  const subject = first.replace(/^subject:\s*/i, '').trim()
  const rest = lines.slice(1).join('\n').replace(/^\s*\n/, '')
  return { subject: subject || null, bodyWithoutSubject: rest }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function channelLabel(c: OutreachTemplate['channel']): string {
  return c === 'email' ? 'Email' : c === 'linkedin' ? 'LinkedIn' : 'Call'
}

export function TemplateDetailClient(props: {
  template: OutreachTemplate
  glossary: TemplateTokenDef[]
}) {
  const { toast } = useToast()
  const parsed = useMemo(() => extractSubject(props.template.body), [props.template.body])
  const subject = parsed.subject
  const bodyText = subject ? parsed.bodyWithoutSubject : props.template.body
  const both = subject ? `Subject: ${subject}\n\n${bodyText}` : bodyText

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{props.template.title}</CardTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{channelLabel(props.template.channel)}</Badge>
                {props.template.tags.slice(0, 6).map((t) => (
                  <Badge key={t} variant="outline" className="text-muted-foreground">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="neon-border hover:glow-effect"
                onClick={async () => {
                  const ok = await copyToClipboard(bodyText)
                  toast({ title: ok ? 'Copied body.' : 'Copy failed.', description: ok ? undefined : 'Your browser blocked clipboard access.' })
                }}
                data-testid="template-detail-copy-body"
              >
                Copy body
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!subject}
                onClick={async () => {
                  if (!subject) return
                  const ok = await copyToClipboard(subject)
                  toast({ title: ok ? 'Copied subject.' : 'Copy failed.', description: ok ? undefined : 'Your browser blocked clipboard access.' })
                }}
                data-testid="template-detail-copy-subject"
              >
                Copy subject
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const ok = await copyToClipboard(both)
                  toast({ title: ok ? 'Copied.' : 'Copy failed.', description: ok ? 'Subject + body' : 'Your browser blocked clipboard access.' })
                }}
                data-testid="template-detail-copy-both"
              >
                Copy both
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground rounded border border-cyan-500/10 bg-background/40 p-4">
            {props.template.body}
          </pre>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Token glossary (this template)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {props.glossary.length === 0 ? (
            <div>No tokens used in this template.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-3">Token</th>
                    <th className="text-left py-2 pr-3">Meaning</th>
                    <th className="text-left py-2">How to fill</th>
                  </tr>
                </thead>
                <tbody>
                  {props.glossary.map((t) => (
                    <tr key={t.token} className="border-b border-cyan-500/10 align-top">
                      <td className="py-2 pr-3 font-mono text-foreground">{t.token}</td>
                      <td className="py-2 pr-3">{t.meaning}</td>
                      <td className="py-2">{t.how}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild className="neon-border hover:glow-effect">
          <Link href={props.template.related_use_case_path}>Related playbook</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/how-scoring-works">How scoring works</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/#try-sample">Try sample</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/pricing">See pricing</Link>
        </Button>
      </div>
    </div>
  )
}

