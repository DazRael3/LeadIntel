import type { Metadata } from 'next'
import { LoginClient } from './LoginClient'

export const metadata: Metadata = {
  title: 'Log in | LeadIntel',
  description: 'Log in to your LeadIntel account.',
  openGraph: {
    title: 'Log in | LeadIntel',
    description: 'Log in to your LeadIntel account.',
    url: 'https://dazrael.com/login',
  },
}

interface LoginPageProps {
  searchParams?: Promise<{
    mode?: string
    redirect?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = (await searchParams) ?? {}
  // Read mode from searchParams (default: 'signin')
  const initialMode = sp.mode === 'signup' ? 'signup' : 'signin'
  
  // Read redirect from searchParams (default: '/dashboard')
  const redirectTo = sp.redirect ?? '/dashboard'

  return <LoginClient initialMode={initialMode} redirectTo={redirectTo} />
}
