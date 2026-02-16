'use client'

import { Pricing } from "@/components/Pricing"
import { TopNav } from "@/components/TopNav"
import { PlanProvider } from "@/components/PlanProvider"
import { BrandHero } from "@/components/BrandHero"

export default function PricingPage() {
  return (
    <PlanProvider initialPlan="free">
      <div className="min-h-screen bg-background">
        <TopNav />
        <Pricing />
        <div className="container mx-auto px-4 pb-12">
          <div className="mt-10 max-w-4xl mx-auto">
            <BrandHero />
          </div>
        </div>
      </div>
    </PlanProvider>
  )
}
