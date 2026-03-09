import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PLATFORM_API_V1_ROUTES } from '@/lib/platform-api/registry'

export const dynamic = 'force-dynamic'

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-background terminal-grid">
      <div className="container mx-auto px-6 py-10 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Developers</h1>
          <p className="text-sm text-muted-foreground">
            LeadIntel provides a workspace-scoped, typed API surface for safe automation and embedding.
          </p>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Getting started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>
              - Create a workspace API key in <Link className="underline" href="/settings/api">Settings → API</Link> (Team plan).
            </div>
            <div>- Keys are shown once at creation and stored hashed. Do not put keys in client-side code.</div>
            <div>- All endpoints are workspace-scoped. No cross-workspace access.</div>
            <div className="pt-2">
              <Badge variant="outline">API version: v1</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">API routes (v1)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto text-sm">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 font-medium">Path</th>
                  <th className="py-2 pr-3 font-medium">Scopes</th>
                  <th className="py-2 pr-3 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORM_API_V1_ROUTES.map((r) => (
                  <tr key={`${r.method}:${r.path}`} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <Badge variant="outline">{r.method}</Badge>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-foreground">{r.path}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{r.requiredScopes.join(', ') || '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Example</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Fetch workspace metadata:</div>
            <pre className="rounded border border-border/60 bg-background/30 p-3 text-xs text-foreground overflow-x-auto">{`curl -s \\
  -H "Authorization: Bearer li_sk_***" \\
  -H "Accept: application/json" \\
  https://YOUR_APP_HOST/api/v1/workspace`}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

