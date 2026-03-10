'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { BenchmarkSummaryBoard } from '@/components/team/BenchmarkSummaryBoard'
import { PlaybookBenchmarkTable } from '@/components/team/PlaybookBenchmarkTable'
import { CategorySignalsBoard } from '@/components/team/CategorySignalsBoard'

type BenchmarksResponse = {
  workspace: { id: string; name: string | null }
  role: string
  windowDays: number
  metrics: unknown[]
}

export function BenchmarksDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<BenchmarksResponse | null>(null)
  const [playbooks, setPlaybooks] = useState<{ rows: unknown[] } | null>(null)
  const [category, setCategory] = useState<{ insights: unknown[] } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [benchRes, playRes, catRes] = await Promise.all([
        fetch('/api/team/benchmarks?windowDays=30', { method: 'GET' }),
        fetch('/api/team/playbook-benchmarks?windowDays=30', { method: 'GET' }),
        fetch('/api/team/category-intelligence?windowDays=30', { method: 'GET' }),
      ])

      const benchJson = (await benchRes.json()) as { success?: boolean; data?: BenchmarksResponse; error?: { message?: string } }
      if (!benchRes.ok || !benchJson.success || !benchJson.data) throw new Error(benchJson.error?.message ?? 'Failed to load benchmarks')
      setData(benchJson.data)

      const playJson = (await playRes.json()) as { success?: boolean; data?: { rows?: unknown[] }; error?: { message?: string } }
      setPlaybooks(playRes.ok && playJson.success ? { rows: playJson.data?.rows ?? [] } : null)

      const catJson = (await catRes.json()) as { success?: boolean; data?: { insights?: unknown[] }; error?: { message?: string } }
      setCategory(catRes.ok && catJson.success ? { insights: catJson.data?.insights ?? [] } : null)
    } catch (e) {
      toast({ title: 'Benchmarks unavailable', description: e instanceof Error ? e.message : 'Failed to load benchmarks', variant: 'destructive' })
      setData(null)
      setPlaybooks(null)
      setCategory(null)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Benchmarks</CardTitle>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Privacy-safe workflow benchmarks compare your workspace to prior periods or anonymized norms when the cohort is large enough.
        </CardContent>
      </Card>

      <BenchmarkSummaryBoard loading={loading} metrics={(data?.metrics ?? []) as unknown[]} />

      {loading ? null : <PlaybookBenchmarkTable rows={(playbooks?.rows ?? []) as unknown[]} />}
      {loading ? null : <CategorySignalsBoard insights={(category?.insights ?? []) as unknown[]} />}
    </div>
  )
}

