'use client'

// No Radix/shadcn roving focus components are used here intentionally to avoid provider/context crashes.
// The mode switch uses plain buttons with URL query updates instead of Radix Tabs.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'

interface LoginClientProps {
  initialMode: 'signin' | 'signup'
  redirectTo: string
}

export function LoginClient({ initialMode, redirectTo }: LoginClientProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [showDevTips, setShowDevTips] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  let supabase: ReturnType<typeof createClient> | null = null
  try {
    supabase = createClient()
  } catch (err: unknown) {
    // If Supabase client creation fails, show error but still render UI
    if (typeof window !== 'undefined') {
      const message = err instanceof Error ? err.message : 'Failed to initialize authentication'
      setInitError(message)
    }
  }

  const isDev = process.env.NODE_ENV !== 'production'

  const handleModeChange = (newMode: 'signin' | 'signup') => {
    setMode(newMode)
    setError(null)
    setInfo(null)
    setShowDevTips(false)
    // Update URL query param to keep it in sync
    const newUrl = `/login?mode=${newMode}&redirect=${encodeURIComponent(redirectTo)}`
    router.replace(newUrl)
  }

  const validatePassword = (): boolean => {
    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters')
      return false
    }
    return true
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setShowDevTips(false)
    
    if (!supabase) {
      setError(initError || 'Authentication not available')
      return
    }
    
    setLoading(true)

    // Client-side password validation
    if (!validatePassword()) {
      setLoading(false)
      return
    }

    try {
      if (mode === 'signup') {
        // Sign up with email confirmation redirect
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          },
        })

        if (signUpError) {
          throw signUpError
        }

        // If session exists, user is automatically signed in - redirect immediately
        if (data.session) {
          router.push(redirectTo)
          return
        }

        // No session returned - handle based on environment
        if (data.user && !data.session) {
          if (isDev) {
            // Dev mode: Show warning about Confirm email being ON
            setInfo('No session returned. For local dev, disable Supabase "Confirm email" and delete the unconfirmed user, then sign up again.')
            setShowDevTips(true)
            setLoading(false)
            return
          } else {
            // Production: Show email confirmation message
            setInfo('Check your email to confirm your account')
            setLoading(false)
            return
          }
        }
      } else {
        // Sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          // In dev mode, provide helpful error message for common issue
          if (isDev && signInError.message?.includes('Invalid login credentials')) {
            throw new Error('Invalid login credentials. You likely signed up while "Confirm email" was ON. Delete user in Supabase and re-signup after turning it OFF.')
          }
          throw signInError
        }

        // Redirect to the target page
        router.push(redirectTo)
        // Note: loading state will be reset by component unmount, but set it here too for safety
        setLoading(false)
      }
    } catch (err: unknown) {
      // Show precise error messages
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed'
      setError(errorMessage)
      setLoading(false)
    } finally {
      // Ensure loading is always reset, even if there's an unexpected error
      setLoading(false)
    }
  }

  // If initialization failed, show error but still render UI
  if (initError && !supabase) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-500/20 bg-card/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center text-red-400">Configuration Error</CardTitle>
            <CardDescription className="text-center">
              Unable to initialize authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-3">
              <p className="font-medium">Error</p>
              <p>{initError}</p>
              <p className="mt-2 text-xs">Please check your environment variables and try again.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-cyan-500/20 bg-card/50">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">LEADINTEL</CardTitle>
          <CardDescription className="text-center">
            {mode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Plain button-based mode switch (no Radix to avoid roving-focus context errors) */}
          <div className="mb-6">
            <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                onClick={() => handleModeChange('signin')}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1 ${
                  mode === 'signin'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'hover:bg-background/50 text-muted-foreground'
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                onClick={() => handleModeChange('signup')}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1 ${
                  mode === 'signup'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'hover:bg-background/50 text-muted-foreground'
                }`}
              >
                Sign up
              </button>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-background"
                minLength={mode === 'signup' ? 6 : undefined}
              />
              {mode === 'signup' && (
                <p className="text-xs text-muted-foreground">Password must be at least 6 characters</p>
              )}
            </div>
            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-3">
                <p className="font-medium">Error</p>
                <p>{error}</p>
              </div>
            )}
            {info && (
              <div className={`text-sm rounded p-3 border ${
                isDev && info.includes('No session returned')
                  ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                  : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
              }`}>
                <div className="flex items-start gap-2">
                  {isDev && info.includes('No session returned') && (
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{isDev && info.includes('No session returned') ? 'Dev Mode Warning' : 'Info'}</p>
                    <p>{info}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Dev Tips Collapsible Section */}
            {isDev && showDevTips && (
              <div className="text-sm bg-muted/50 border border-cyan-500/20 rounded p-3">
                <button
                  type="button"
                  onClick={() => setShowDevTips(!showDevTips)}
                  className="flex items-center justify-between w-full text-left font-medium text-cyan-400 hover:text-cyan-300"
                >
                  <span>Dev Tips</span>
                  {showDevTips ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {showDevTips && (
                  <div className="mt-3 space-y-2 text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1.5 ml-2">
                      <li>
                        <span className="font-medium">Disable Confirm email:</span>
                        <div className="ml-4 mt-0.5 text-xs">
                          In Supabase Dashboard → Authentication → Settings → Email Auth, turn OFF &quot;Enable email confirmations&quot;
                        </div>
                      </li>
                      <li>
                        <span className="font-medium">Delete user and re-signup:</span>
                        <div className="ml-4 mt-0.5 text-xs">
                          In Supabase Dashboard → Authentication → Users, find and delete the unconfirmed user account
                        </div>
                      </li>
                      <li>
                        <span className="font-medium">Then sign in:</span>
                        <div className="ml-4 mt-0.5 text-xs">
                          After deleting the user, sign up again. You should be logged in immediately.
                        </div>
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30"
              >
                {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
