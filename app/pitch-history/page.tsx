import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'

export default async function PitchHistoryPage() {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login?mode=signin&redirect=/pitch-history')
  }

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, company_name, ai_personalized_pitch, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[pitch-history] failed to load leads', error)
  }

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
          {(leads || []).map((lead) => (
            <Card key={lead.id} className="border-cyan-500/20 bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{lead.company_name || 'Unknown company'}</span>
                  <span className="text-xs text-muted-foreground">
                    {lead.created_at
                      ? formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })
                      : 'Unknown'}
                  </span>
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
