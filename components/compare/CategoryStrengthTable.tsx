'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type CategoryStrengthRow = {
  category: string
  leadintel: string
  competitorSet: string
}

export function CategoryStrengthTable(props: { rows: CategoryStrengthRow[]; title?: string }) {
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{props.title ?? 'Category strengths (high level)'}</CardTitle>
      </CardHeader>
      <CardContent
        className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        tabIndex={0}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
              <th className="text-left py-2 pr-3">Category</th>
              <th className="text-left py-2 pr-3">LeadIntel</th>
              <th className="text-left py-2">Competitive set</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((r) => (
              <tr key={r.category} className="border-b border-cyan-500/10">
                <td className="py-2 pr-3 font-medium text-foreground">{r.category}</td>
                <td className="py-2 pr-3 text-muted-foreground">{r.leadintel}</td>
                <td className="py-2 text-muted-foreground">{r.competitorSet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

