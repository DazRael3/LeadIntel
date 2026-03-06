'use client'

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { PitchGenerator } from "@/components/PitchGenerator"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { PlanProvider } from "@/components/PlanProvider"
import type { PitchTemplateId } from "@/lib/ai/pitch-templates"

function PitchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [companyUrl, setCompanyUrl] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [auto, setAuto] = useState(false)
  const [templateId, setTemplateId] = useState<PitchTemplateId>('default')

  useEffect(() => {
    const url = searchParams.get('url')
    const name = searchParams.get('name')
    const autoParam = searchParams.get('auto')
    const tpl = searchParams.get('template')
    if (url) setCompanyUrl(decodeURIComponent(url))
    if (name) setCompanyName(decodeURIComponent(name))
    setAuto(autoParam === '1' || autoParam === 'true')
    if (tpl === 'default' || tpl === 'short_email' || tpl === 'call_opener' || tpl === 'linkedin_dm') {
      setTemplateId(tpl)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Generate Pitch</h1>
              {companyName && (
                <p className="text-sm text-muted-foreground">{companyName}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <PlanProvider initialPlan="free">
          <PitchGenerator initialUrl={companyUrl} initialTemplateId={templateId} autoGenerate={auto} />
        </PlanProvider>
      </main>
    </div>
  )
}

export default function PitchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <PitchContent />
    </Suspense>
  )
}
