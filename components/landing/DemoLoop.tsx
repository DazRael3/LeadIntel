'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Step = 0 | 1 | 2

export function DemoLoop() {
  const [step, setStep] = useState<Step>(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => ((s + 1) % 3) as Step)
    }, 2600)
    return () => window.clearInterval(id)
  }, [])

  const content = useMemo(() => {
    if (step === 0) {
      return {
        title: '1) Enter your ICP',
        lines: [
          '> ICP: B2B SaaS → mid‑market / enterprise',
          '> Accounts: 10 target logos',
          '',
          'Press Run →',
        ],
      }
    }
    if (step === 1) {
      return {
        title: '2) See the Daily Digest',
        lines: [
          'LeadIntel Daily Digest',
          '- Funding round detected · priority high',
          '- Hiring spike detected · priority medium',
          '- Product launch detected · priority low',
          '',
          'Shortlist ready for outreach →',
        ],
      }
    }
    return {
      title: '3) Generate a pitch',
      lines: [
        'Subject: Quick idea based on recent signals',
        '',
        'Hi — quick note.',
        'Noticed a few signals this week.',
        'Open to a 10‑minute chat?',
      ],
    }
  }, [step])

  return (
    <Card className="border-cyan-500/20 bg-card/50 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Workflow preview loop</CardTitle>
        <div className="text-xs text-muted-foreground">{content.title}</div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="li-codeblock p-4">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
            {content.lines.join('\n')}
          </pre>
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          This is a preview of the workflow: ICP → digest → pitch.
        </div>
      </CardContent>
    </Card>
  )
}

