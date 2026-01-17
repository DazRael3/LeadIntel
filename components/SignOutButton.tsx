'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export function SignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSignOut = async () => {
    setLoading(true)
    try {
      // Attempt sign out - handle missing refresh token gracefully
      const { error } = await supabase.auth.signOut()
      
      // If refresh token is missing, clear cookies manually and continue
      if (error && error.message?.includes('refresh_token_not_found')) {
        // Clear all Supabase auth cookies
        const cookieNames = [
          'sb-refresh-token',
          'sb-access-token',
          'sb-provider-token',
          'sb-provider-refresh-token'
        ]
        cookieNames.forEach(name => {
          document.cookie = `${name}=; path=/; max-age=0`
        })
      } else if (error) {
        console.error('Error signing out:', error)
        // Still redirect even if signOut fails
      }
      
      router.push('/login')
    } catch (error: any) {
      // Handle any unexpected errors gracefully
      console.error('Error signing out:', error)
      // Clear cookies as fallback
      const cookieNames = [
        'sb-refresh-token',
        'sb-access-token',
        'sb-provider-token',
        'sb-provider-refresh-token'
      ]
      cookieNames.forEach(name => {
        document.cookie = `${name}=; path=/; max-age=0`
      })
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSignOut}
      disabled={loading}
      className="border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20"
    >
      <LogOut className="h-4 w-4 mr-2" />
      {loading ? 'Signing out...' : 'Sign out'}
    </Button>
  )
}
