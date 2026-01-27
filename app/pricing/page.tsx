'use client'

import { Pricing } from "@/components/Pricing"
import { PlanProvider } from "@/components/PlanProvider"

export default function PricingPage() {
  return (
    <PlanProvider initialPlan="free">
      <div className="min-h-screen bg-background">
        <Pricing />
      </div>
    </PlanProvider>
  )
}
