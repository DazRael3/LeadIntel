'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'

export type TemplateChannel = 'email' | 'linkedin' | 'call'

export type Template = {
  id: string
  channel: TemplateChannel
  title: string
  body: string
  tags: string[]
}

type Token = { token: string; meaning: string; how: string }

function channelLabel(c: TemplateChannel): string {
  return c === 'email' ? 'Email' : c === 'linkedin' ? 'LinkedIn' : 'Call'
}

function extractSubject(body: string): { subject: string | null; bodyWithoutSubject: string } {
  const lines = body.split('\n')
  if (lines.length === 0) return { subject: null, bodyWithoutSubject: body }
  const first = lines[0].trim()
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

export function TemplatesLibraryClient(props: { templates: Template[]; tokens: Token[] }) {
  const { toast } = useToast()
  const [channel, setChannel] = useState<TemplateChannel | 'all'>('all')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | 'all'>('all')

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of props.templates) for (const x of t.tags) set.add(x)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [props.templates])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return props.templates.filter((t) => {
      if (channel !== 'all' && t.channel !== channel) return false
      if (tag !== 'all' && !t.tags.includes(tag)) return false
      if (!q) return true
      return (t.title + '\n' + t.body).toLowerCase().includes(q)
    })
  }, [props.templates, channel, tag, query])

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg">Template library</CardTitle>
            <Badge variant="outline">{filtered.length} shown</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Search</div>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title or body…" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Channel</div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'email', 'linkedin', 'call'] as const).map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={channel === c ? 'default' : 'outline'}
                  className={channel === c ? 'neon-border hover:glow-effect' : ''}
                  onClick={() => setChannel(c)}
                >
                  {c === 'all' ? 'All' : channelLabel(c)}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Tag</div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={tag === 'all' ? 'default' : 'outline'}
                className={tag === 'all' ? 'neon-border hover:glow-effect' : ''}
                onClick={() => setTag('all')}
              >
                All
              </Button>
              {allTags.slice(0, 10).map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={tag === t ? 'default' : 'outline'}
                  onClick={() => setTag(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
            {allTags.length > 10 ? <div className="mt-2 text-[11px] text-muted-foreground">Showing 10 tags.</div> : null}
          </div>

          <div className="md:col-span-3 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Tokens use curly format (example: <span className="font-mono text-foreground">{'{{company}}'}</span>).
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setChannel('all')
                setTag('all')
                setQuery('')
              }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((t) => {
          const parsed = extractSubject(t.body)
          const subject = parsed.subject
          const bodyText = subject ? parsed.bodyWithoutSubject : t.body
          const both = subject ? `Subject: ${subject}\n\n${bodyText}` : bodyText

          return (
            <Card key={t.id} className="border-cyan-500/20 bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  <Badge variant="outline">{channelLabel(t.channel)}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {t.tags.map((x) => (
                    <Badge key={x} variant="outline" className="text-muted-foreground">
                      {x}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="neon-border hover:glow-effect"
                    onClick={async () => {
                      const ok = await copyToClipboard(bodyText)
                      toast({ title: ok ? 'Copied body.' : 'Copy failed.', description: ok ? undefined : 'Your browser blocked clipboard access.' })
                    }}
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
                  >
                    Copy both
                  </Button>
                </div>

                <pre className="whitespace-pre-wrap text-sm text-muted-foreground rounded border border-cyan-500/10 bg-background/40 p-4">
                  {t.body}
                </pre>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Token glossary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
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
                {props.tokens.map((t) => (
                  <tr key={t.token} className="border-b border-cyan-500/10 align-top">
                    <td className="py-2 pr-3 font-mono text-foreground">{t.token}</td>
                    <td className="py-2 pr-3">{t.meaning}</td>
                    <td className="py-2">{t.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

