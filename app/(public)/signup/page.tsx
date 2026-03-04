import type { Metadata } from 'next'
import { LoginClient } from '../login/LoginClient'

export const metadata: Metadata = {
  title: 'Sign up | LeadIntel',
  description: 'Create a LeadIntel account.',
  openGraph: {
    title: 'Sign up | LeadIntel',
    description: 'Create a LeadIntel account.',
    url: 'https://dazrael.com/signup',
  },
}

interface SignupPageProps {
  searchParams?: {
    redirect?: string
  }
}

export default function SignupPage({ searchParams = {} }: SignupPageProps) {
  const redirectTo = searchParams?.redirect ?? '/dashboard'
  return <LoginClient initialMode="signup" redirectTo={redirectTo} />
}

