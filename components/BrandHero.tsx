'use client'

import Image from 'next/image'

export function BrandHero() {
  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/10 bg-slate-950/80">
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute -inset-24 bg-gradient-to-br from-cyan-500/10 via-purple-500/5 to-transparent blur-2xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.10),transparent_50%)]" />
        </div>

        <div className="relative mx-auto flex h-40 max-w-4xl items-center justify-center sm:h-64">
          <div className="relative h-32 w-[min(560px,90%)] sm:h-52">
            <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-cyan-400/5 blur-xl" />
            <Image
              src="/branding/LeadIntel_DazRael.png"
              alt="LeadIntel brand"
              fill
              sizes="(max-width: 640px) 90vw, 560px"
              className="object-contain drop-shadow-[0_0_24px_rgba(34,211,238,0.18)]"
              // Avoid Next image optimizer coupling in E2E/dev environments.
              unoptimized
              priority={false}
            />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
          <div className="text-center text-xs uppercase tracking-[0.35em] text-muted-foreground/70">
            LeadIntel · Professional Terminal
          </div>
        </div>
      </div>
    </div>
  )
}

