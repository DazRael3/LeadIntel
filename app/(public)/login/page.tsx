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
  searchParams?: {
    mode?: string
    redirect?: string
  }
}

export default function LoginPage({ searchParams = {} }: LoginPageProps) {
  // Read mode from searchParams (default: 'signin')
  const initialMode = searchParams?.mode === 'signup' ? 'signup' : 'signin'
  
  // Read redirect from searchParams (default: '/dashboard')
  const redirectTo = searchParams?.redirect ?? '/dashboard'

  return <LoginClient initialMode={initialMode} redirectTo={redirectTo} />
}
