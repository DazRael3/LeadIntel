"use client"

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Copy, Eye, ArrowDownUp, ArrowLeft, ArrowRight, Lock } from 'lucide-react'
import { scoreLead } from '@/lib/leadScoring'

export interface HistoryLead {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  ai_personalized_pitch: string | null
  created_at: string | null
  updated_at: string | null
}

interface HistoryClientProps {
  initialLeads: HistoryLead[]
  isPro: boolean
}

const PAGE_SIZE = 10

function escapeCsv(val: string) {
  const needsQuotes = val.includes(',') || val.includes('"') || val.includes('\n')
  const escaped = val.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

function toCsv(leads: HistoryLead[]): string {
  const header = ['company_name', 'company_domain', 'company_url', 'ai_personalized_pitch', 'created_at', 'updated_at']
  const rows = leads.map(l => [
    l.company_name || '',
    l.company_domain || '',
    l.company_url || '',
    l.ai_personalized_pitch || '',
    l.created_at || '',
    l.updated_at || '',
  ])
  return [header.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n')
}

function extractSubject(pitch?: string | null): string {
  if (!pitch) return ''
  const firstLine = pitch.split('\n').find(line => line.trim().length > 0) || pitch
  return firstLine.trim().slice(0, 80)
}

export function HistoryClient({ initialLeads, isPro }: HistoryClientProps) {
  const [query, setQuery] = useState('')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initialLeads
      .filter(l => {
        if (!q) return true
        return (
          (l.company_name || '').toLowerCase().includes(q) ||
          (l.company_domain || '').toLowerCase().includes(q) ||
          (l.company_url || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
        return sortDir === 'desc' ? bDate - aDate : aDate - bDate
      })
  }, [initialLeads, query, sortDir])

  const paged = useMemo(() => {
    const start = page * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setToast(`${label} copied`)
      setTimeout(() => setToast(null), 1800)
    } catch {
      setToast('Copy failed')
      setTimeout(() => setToast(null), 1800)
    }
  }

  const handleExport = () => {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pitch-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    setToast('CSV exported')
    setTimeout(() => setToast(null), 1800)
  }

  return (
    <div className="min-h-screen bg-background terminal-grid py-10">
      <div className="container mx-auto px-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold bloomberg-font neon-cyan">Pitch History</h1>
            <p className="text-muted-foreground mt-1">
              Your generated pitches. Search, sort, copy, and export.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))}
              className="neon-border hover:glow-effect"
            >
              <ArrowDownUp className="h-4 w-4 mr-2" />
              {sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
            </Button>
            <Button
              variant={isPro ? 'default' : 'outline'}
              disabled={!isPro}
              onClick={handleExport}
              className="neon-border hover:glow-effect"
            >
              <Download className="h-4 w-4 mr-2" />
              {isPro ? 'Export CSV' : 'Pro required'}
            </Button>
          </div>
        </div>

        {!isPro && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            CSV export is a Pro feature. <a href="/pricing" className="text-cyan-400 underline ml-1">Upgrade</a>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Input
            placeholder="Search company name, domain, or URL..."
            value={query}
            onChange={(e) => {
              setPage(0)
              setQuery(e.target.value)
            }}
            className="max-w-xl"
          />
        </div>

        {toast && (
          <div className="text-sm text-cyan-300">{toast}</div>
        )}

        {filtered.length === 0 ? (
          <Card className="border-cyan-500/20 bg-card/60">
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-lg font-semibold">No pitches yet</p>
              <p className="text-muted-foreground">Generate your first pitch to see it here.</p>
              <Button asChild className="neon-border hover:glow-effect">
                <a href="/dashboard">Generate your first pitch</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader>
              <CardTitle className="text-xl bloomberg-font neon-cyan">History</CardTitle>
              <CardDescription>{filtered.length} result(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {paged.map(lead => {
                const pitchText = lead.ai_personalized_pitch || ''
                const subject = extractSubject(pitchText)
                const { score, reasons } = scoreLead({ companyName: lead.company_name || undefined, pitch: pitchText })
                return (
                  <div key={lead.id} className="p-4 border border-cyan-500/20 rounded-lg bg-background/40 space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-lg font-semibold text-cyan-300">
                          {lead.company_name || 'Unknown company'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {lead.company_domain || lead.company_url || 'No domain'}
                        </div>
                      </div>
                      <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                        Score: {score}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created: {lead.created_at ? new Date(lead.created_at).toLocaleString() : 'Unknown'}
                      {lead.updated_at && ` • Updated: ${new Date(lead.updated_at).toLocaleString()}`}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                      {pitchText || 'No pitch text'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(pitchText, 'Pitch')}
                        disabled={!pitchText}
                        className="h-8 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy Pitch
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(subject, 'Subject')}
                        disabled={!subject}
                        className="h-8 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy Subject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(selected === lead.id ? null : lead.id)}
                        className="h-8 text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" /> {selected === lead.id ? 'Hide Details' : 'View Details'}
                      </Button>
                      <Badge variant="outline" className="border-cyan-500/30 text-muted-foreground">
                        Why this score? {reasons.join('; ') || 'Heuristics not met'}
                      </Badge>
                    </div>
                    {selected === lead.id && (
                      <div className="mt-3 p-3 rounded border border-cyan-500/20 bg-background/60">
                        <p className="text-sm whitespace-pre-wrap">{pitchText || 'No pitch'}</p>
                      </div>
                    )}
                  </div>
                )
              })}

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-8 text-xs"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <div className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-8 text-xs"
                >
                  Next <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
