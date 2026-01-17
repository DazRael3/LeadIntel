'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { LogIn, UserPlus, LayoutDashboard, LogOut } from 'lucide-react'

export function TopNav() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check initial auth state
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)
      setLoading(false)
    }

    checkAuth()

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="border-b border-cyan-500/20 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo/Title */}
          <Link href="/" className="flex items-center space-x-2 group">
            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent group-hover:from-cyan-300 group-hover:to-purple-300 transition-colors">
              LeadIntel
            </span>
          </Link>

          {/* Right: Auth buttons */}
          <div className="flex items-center space-x-3">
            {loading ? (
              <div className="h-9 w-20 bg-muted animate-pulse rounded" />
            ) : isLoggedIn ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
                >
                  <Link href="/login?mode=signin&redirect=/">
                    <LogIn className="h-4 w-4 mr-2" />
                    Log in
                  </Link>
                </Button>
                <Button
                  asChild
                  className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30"
                >
                  <Link href="/login?mode=signup&redirect=/">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Sign up
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
