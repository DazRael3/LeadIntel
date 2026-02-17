'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

type ThemeChoice = 'light' | 'dark'

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const current: ThemeChoice = useMemo(() => {
    const t = mounted ? ((theme === 'system' ? resolvedTheme : theme) ?? 'dark') : 'dark'
    return t === 'light' ? 'light' : 'dark'
  }, [mounted, theme, resolvedTheme])

  const nextTheme: ThemeChoice = current === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-foreground hover:bg-muted/70"
      aria-label="Toggle color theme"
    >
      {current === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      <span className="whitespace-nowrap font-medium">Theme</span>
      <span className="text-muted-foreground">{current === 'dark' ? 'Dark' : 'Light'}</span>
      <span className="sr-only">{current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
    </button>
  )
}

