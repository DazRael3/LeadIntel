import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { buildCompetitiveReportNewUrl } from '@/lib/reports/reportLinks'

export const metadata: Metadata = {
  title: 'Pitch history | LeadIntel',
  description: 'Your generated pitches, listed by time.',
  robots: { index: false, follow: false },
}

type PitchHistoryLeadRow = {
  id: string
  company_name: string | null
  company_url: string | null
  ai_personalized_pitch: string | null
  created_at: string | null
}

export default async function PitchHistoryPage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login?mode=signin&redirect=/pitch-history')
  }

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, company_name, company_url, ai_personalized_pitch, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[pitch-history] failed to load leads', error)
  }

  const rows = (leads ?? []) as PitchHistoryLeadRow[]

  return (
    <div className="min-h-screen bg-background terminal-grid py-12">
      <div className="container mx-auto px-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold bloomberg-font neon-cyan">Pitch History</h1>
          <p className="text-muted-foreground mt-2">
            Your generated pitches with timestamps. Export from Lead Library for CSV.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {rows.map((lead) => (
            <Card key={lead.id} className="border-cyan-500/20 bg-card/60">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <span>{lead.company_name || 'Unknown company'}</span>
                  <div className="flex items-center gap-2">
                    {lead.company_name ? (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={buildCompetitiveReportNewUrl({
                            company: lead.company_name,
                            url: lead.company_url,
                            auto: true,
                          })}
                        >
                          Create report
                        </Link>
                      </Button>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {lead.created_at ? formatDistanceToNow(new Date(lead.created_at), { addSuffix: true }) : 'Unknown'}
                    </span>
                  </div>
                </CardTitle>
                <CardDescription className="text-xs uppercase tracking-wider">AI Personalized Pitch</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {lead.ai_personalized_pitch || 'No pitch stored'}
                </p>
              </CardContent>
            </Card>
          ))}

          {(!leads || leads.length === 0) && (
            <Card className="border-cyan-500/20 bg-card/60">
              <CardContent className="py-10 text-center text-muted-foreground">
                No pitches yet. Generate a pitch to see it here.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
