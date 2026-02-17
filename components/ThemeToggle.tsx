'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const theme = mounted ? (resolvedTheme ?? 'dark') : 'dark'
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-foreground hover:bg-muted/70"
      aria-label="Toggle color theme"
    >
      {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      <span className="whitespace-nowrap">Theme</span>
      <span className="sr-only">{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
    </button>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

type ThemeChoice = 'light' | 'dark'

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const current: ThemeChoice = useMemo(() => {
    // During SSR/hydration, `resolvedTheme` can be undefined; avoid UI thrash.
    const t = (theme === 'system' ? resolvedTheme : theme) ?? 'dark'
    return t === 'light' ? 'light' : 'dark'
  }, [theme, resolvedTheme])

  const next: ThemeChoice = current === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/60 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800/80 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800/80 light:border-slate-300/70 light:bg-slate-50/80 light:text-slate-800 light:hover:bg-slate-100/80"
      aria-label="Toggle color theme"
    >
      {mounted ? (
        <>
          {current === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          <span className="font-medium">Theme</span>
          <span className="text-slate-400 dark:text-slate-400 light:text-slate-500">
            {current === 'dark' ? 'Dark' : 'Light'}
          </span>
        </>
      ) : (
        <>
          <span className="font-medium">Theme</span>
        </>
      )}
    </button>
  )
}

