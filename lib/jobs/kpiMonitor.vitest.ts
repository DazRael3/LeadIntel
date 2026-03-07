import { describe, expect, it } from 'vitest'
import { evaluateKpiMonitorRow } from '@/lib/jobs/kpiMonitor'

describe('kpiMonitor row evaluation', () => {
  it('previous=0 and current=0 never alerts and uses no_baseline_previous', () => {
    const r = evaluateKpiMonitorRow({
      window: '24h',
      current: 0,
      previous: 0,
      dropPctThreshold: 30,
      minPrevThreshold: 20,
      minPreviousBaseline: 10,
    })
    expect(r.alert).toBe(false)
    expect(r.note).toBe('no_baseline_previous')
    expect(r.dropPct).toBe(0)
  })

  it('previous below baseline never alerts and uses insufficient_baseline note', () => {
    const r = evaluateKpiMonitorRow({
      window: '24h',
      current: 0,
      previous: 5,
      dropPctThreshold: 30,
      minPrevThreshold: 20,
      minPreviousBaseline: 10,
    })
    expect(r.alert).toBe(false)
    expect(r.note).toBe('insufficient_baseline_prev_lt_10')
  })

  it('alerts when baseline is met and drop threshold is met', () => {
    const r = evaluateKpiMonitorRow({
      window: '7d',
      current: 20,
      previous: 50,
      dropPctThreshold: 20,
      minPrevThreshold: 1,
      minPreviousBaseline: 30,
    })
    // dropPct = (50-20)/50 = 60%
    expect(r.dropPct).toBe(60)
    expect(r.note).toBeNull()
    expect(r.alert).toBe(true)
  })
})

