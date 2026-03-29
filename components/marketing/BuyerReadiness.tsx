'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function BuyerReadiness() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Current trust posture</CardTitle>
            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
              No overclaims
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <div className="space-y-2">
            <div>What’s in place today:</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Workspace (tenant) isolation and access-controlled data boundaries.</li>
              <li>Row-level security policies for user/workspace-scoped access.</li>
              <li>Server-side secret handling (no client exposure of private keys).</li>
              <li>Rate limiting on public and authenticated routes.</li>
              <li>Structured logging and request IDs for debuggability.</li>
              <li>Stripe for billing; Supabase for authentication and database.</li>
              <li>Webhook + export actions designed for operational handoff.</li>
              <li>Audit visibility for key team-governed actions (templates/approvals and operational handoff surfaces).</li>
            </ul>
          </div>
          <div className="space-y-2">
            <div>What we do not claim:</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>SOC 2 / ISO 27001 certifications unless explicitly stated.</li>
              <li>SSO/SAML/SCIM as generally available features.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Operational boundaries</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <ul className="list-disc pl-5 space-y-1">
            <li>LeadIntel is not a general-purpose contact database.</li>
            <li>People and buying-group surfaces are persona-level recommendations (heuristic, signal-based).</li>
            <li>First-party intent appears only when a match exists; when it doesn’t, the product shows a premium empty state.</li>
            <li>When source coverage is thin, the product says so directly in the UI.</li>
            <li>Support and deletion requests route through the published support contact path.</li>
          </ul>
          <div className="text-xs text-muted-foreground">
            For larger deployments, use the Trust Center docs and contact us to align on rollout requirements and current control scope.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

