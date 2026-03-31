'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { usePlan } from '@/components/PlanProvider'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Variant = {
  id: string
  label: string
  channel: string | null
  angle: string
  opener: string
  whyNowBullets: string[]
  limitations: string[]
  status: string
  createdAt: string
}

type AngleSet = {
  id: string
  title: string
  context: string | null
  tags: string[]
  source: string | null
  createdAt: string
  variants: Variant[]
}

type ListEnvelope =
  | { ok: true; data: { workspace: { id: string; name: string; role: string } | null; angleSets: AngleSet[] } }
  | { ok: false; error?: { message?: string } }

type CreateEnvelope =
  | { ok: true; data: { ok: true; angleSetId: string } }
  | { ok: false; error?: { message?: string } }

export function AnglesClient() {
  const { tier, capabilities } = usePlan()
  const { toast } = useToast()
  const allowed = capabilities.angle_library === true

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ListEnvelope | null>(null)
  const [creating, setCreating] = useState(false)

  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [tagInput, setTagInput] = useState('')

  const [variantLabel, setVariantLabel] = useState('A')
  const [variantChannel, setVariantChannel] = useState<'email' | 'linkedin_dm' | 'call_opener'>('email')
  const [variantAngle, setVariantAngle] = useState('')
  const [variantOpener, setVariantOpener] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/angles', { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as ListEnvelope | null
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    void refresh()
  }, [allowed, refresh])

  const model = useMemo(() => (data && data.ok === true ? data.data : null), [data])
  const showLocked = !allowed

  async function create() {
    const t = title.trim()
    if (!t) return
    const angle = variantAngle.trim()
    const opener = variantOpener.trim()
    if (!angle || !opener) return

    const tags = tagInput
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 12)

    setCreating(true)
    try {
      const res = await fetch('/api/angles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: t,
          context: context.trim() ? context.trim() : null,
          tags,
          source: 'manual',
          sourceRef: {},
          variants: [
            {
              label: variantLabel.trim() || 'A',
              channel: variantChannel,
              angle,
              opener,
              whyNowBullets: [],
              limitations: [],
            },
          ],
        }),
      })
      const json = (await res.json().catch(() => null)) as CreateEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
        track('angle_library_create_failed', { tier })
        return
      }
      toast({ title: 'Saved.' })
      track('angle_library_created', { tier })
      setTitle('')
      setContext('')
      setTagInput('')
      setVariantAngle('')
      setVariantOpener('')
      await refresh()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="angles-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Angles</h1>
            <p className="mt-1 text-sm text-muted-foreground">Save and reuse outbound angles with lightweight A/B variants.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{tier === 'starter' ? 'Starter' : tier === 'closer' ? 'Closer' : tier === 'closer_plus' ? 'Closer+' : 'Team'}</Badge>
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        {showLocked ? (
          <Card className="border-purple-500/20 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upgrade required</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <div>Angle library unlocks on Closer+.</div>
              <Button asChild size="sm" className="neon-border hover:glow-effect">
                <Link href="/pricing?target=closer_plus">View Closer+</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-cyan-500/20 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">New angle</CardTitle>
                  <Badge variant="outline">{model?.workspace?.name ?? 'Workspace'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-foreground">Title</div>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Timing-first outreach for hiring spike" />
                  <div className="text-xs font-medium text-foreground">Context (optional)</div>
                  <Textarea value={context} onChange={(e) => setContext(e.target.value)} rows={4} placeholder="What is this for? When should reps use it?" />
                  <div className="text-xs font-medium text-foreground">Tags (comma-separated)</div>
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="hiring, revops, security" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-foreground">Variant</div>
                    <Badge variant="outline">A/B</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)} placeholder="Label (A/B)" />
                    <select
                      value={variantChannel}
                      onChange={(e) => setVariantChannel(e.target.value as 'email' | 'linkedin_dm' | 'call_opener')}
                      className="h-9 w-full rounded border border-cyan-500/20 bg-background px-2 text-sm"
                    >
                      <option value="email">Email</option>
                      <option value="linkedin_dm">LinkedIn DM</option>
                      <option value="call_opener">Call opener</option>
                    </select>
                  </div>
                  <div className="text-xs font-medium text-foreground">Angle</div>
                  <Textarea value={variantAngle} onChange={(e) => setVariantAngle(e.target.value)} rows={3} placeholder="The core angle or hypothesis (short)." />
                  <div className="text-xs font-medium text-foreground">Opener</div>
                  <Textarea value={variantOpener} onChange={(e) => setVariantOpener(e.target.value)} rows={5} placeholder="Paste the opener your rep can send." />
                  <div className="flex justify-end">
                    <Button size="sm" className="neon-border hover:glow-effect" onClick={() => void create()} disabled={creating}>
                      {creating ? 'Saving…' : 'Save to library'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-cyan-500/20 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">Library</CardTitle>
                  <Badge variant="outline">{(model?.angleSets ?? []).length} saved</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : (model?.angleSets ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">No angles saved yet. Save one from outreach variants or reports.</div>
                ) : (
                  <div className="space-y-3">
                    {(model?.angleSets ?? []).slice(0, 50).map((a) => (
                      <details key={a.id} className="rounded border border-cyan-500/10 bg-background/30 p-3">
                        <summary className="cursor-pointer text-sm text-foreground">
                          {a.title}{' '}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {a.tags.length > 0 ? `#${a.tags.join(' #')}` : ''}
                          </span>
                        </summary>
                        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                          {a.context ? <div className="whitespace-pre-wrap">{a.context}</div> : null}
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {a.variants.slice(0, 6).map((v) => (
                              <div key={v.id} className="rounded border border-cyan-500/10 bg-card/30 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-foreground font-medium">
                                    {v.label} {v.channel ? `· ${v.channel}` : ''}
                                  </div>
                                  <Badge variant="outline">{v.status}</Badge>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{v.angle}</div>
                                <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{v.opener}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

