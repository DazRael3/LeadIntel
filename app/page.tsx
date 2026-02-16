import { redirect } from 'next/navigation'
import LandingClient from './LandingClient'
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      redirect('/dashboard')
    }
  } catch {
    // If Supabase env vars are missing/malformed, fall back to anonymous landing.
  }

  return <LandingClient />
}
